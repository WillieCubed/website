import matter from 'gray-matter';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';

import { importMdx } from '../../lib/studio/document';
import { getStudioPool, getStudioStore } from '../../lib/studio/store';

// Private storage must be migrated first. Removal is opt-in and follows a read-back.
const remove = process.argv.includes('--remove-verified-files');
const directory = resolve('content/writings');
const store = getStudioStore();
try {
  for (const filename of await readdir(directory)) {
    if (!/\.mdx?$/.test(filename) || filename.startsWith('_')) continue;
    const path = resolve(directory, filename);
    const source = await readFile(path);
    if (matter(source).data.draft !== true) continue;
    const slug = filename.replace(/\.mdx?$/, '');
    const sha = createHash('sha1')
      .update(`blob ${source.length}\0`)
      .update(source)
      .digest('hex');
    const body = importMdx(source.toString(), sha);
    const existing = await store.bySlug(slug);
    const saved = existing ?? (await store.create(slug, body));
    // A prior import may have subsequently been edited. Find the retained original.
    const original = (await store.revisions(saved.id)).find(
      (revision) => revision.body.baseFileSha === sha
    );
    assert.ok(
      original,
      `No matching durable import for ${slug}; leaving the source in place.`
    );
    assert.deepEqual(
      original.body,
      JSON.parse(JSON.stringify(body)),
      `Import changed ${slug}; leaving the source in place.`
    );
    const verified = await store.revision(original.id);
    assert.deepEqual(verified?.body, original.body);
    if (remove) {
      assert.deepEqual(
        await readFile(path),
        source,
        `${slug} changed during import.`
      );
      await unlink(path);
    }
    console.log(
      `${remove ? 'Imported, verified and removed' : 'Imported and verified'}: ${slug}`
    );
  }
} finally {
  await getStudioPool().end();
}
