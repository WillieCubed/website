import { GET } from '@/app/api/studio-publication/[slug]/route';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import test from 'node:test';

test('publication proof hashes the exact deployed MDX bytes and withholds private records', async () => {
  const slug = `proof-${randomUUID()}`;
  const path = `content/writings/${slug}.mdx`;
  const originalMode = process.env.SITE_MODE;
  const request = new Request(
    `https://willie.page/api/studio-publication/${slug}`
  );
  const context = { params: Promise.resolve({ slug }) };
  const source =
    '---\nstudioRevision: immutable-revision\n---\n\n<StudioBlock />\n';
  try {
    process.env.SITE_MODE = 'public';
    await writeFile(path, source);
    const expected = spawnSync('git', ['hash-object', '--stdin'], {
      input: source,
      encoding: 'utf8',
    });
    assert.equal(expected.status, 0);
    const response = await GET(request, context);
    assert.equal(response.status, 200);
    const proof = await response.json();
    assert.equal(proof.revisionId, 'immutable-revision');
    assert.equal(proof.sourceSha, expected.stdout.trim());
    assert.equal(response.headers.get('cache-control'), 'no-store');
    await writeFile(path, `${source}\n`);
    assert.notEqual(
      (await (await GET(request, context)).json()).sourceSha,
      proof.sourceSha
    );
    for (const flag of ['draft', 'hidden']) {
      await writeFile(
        path,
        source.replace('studioRevision:', `${flag}: true\nstudioRevision:`)
      );
      assert.equal((await GET(request, context)).status, 404);
    }
    await writeFile(path, source);
    process.env.SITE_MODE = 'preview';
    assert.equal((await GET(request, context)).status, 404);
  } finally {
    await rm(path, { force: true });
    if (originalMode === undefined) delete process.env.SITE_MODE;
    else process.env.SITE_MODE = originalMode;
  }
});
