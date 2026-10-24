import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';

const originalCwd = process.cwd();
const root = mkdtempSync(join(tmpdir(), 'writing-backlinks-'));
const directory = join(root, 'content/writings');
mkdirSync(directory, { recursive: true });
process.chdir(root);
const { getBacklinksForPost } = await import('@/lib/writings/backlinks');
after(() => {
  process.chdir(originalCwd);
  rmSync(root, { recursive: true, force: true });
});
function write(slug: string, body: string, date = '2026-10-20', draft = false) {
  writeFileSync(
    join(directory, slug),
    `---\ntitle: ${slug}\ndescription: Description of ${slug}\npublished: ${date}\ndraft: ${draft}\n---\n${body}`
  );
}
write('alpha.md', '[Target](/writings/target#part "A title")');
write(
  'alpha.mdx',
  '<a href="/writings/target/">Again</a> [Target](/writings/target)'
);
write(
  'beta.mdx',
  '<SiteLink href="/writings/target#part">Target</SiteLink>',
  '2026-10-22'
);
write('target.mdx', '[Self](/writings/target)');
write('_hidden.mdx', '[Hidden](/writings/target)');
write('opengraph-image.mdx', '[Reserved](/writings/target)');
write('draft.mdx', '[Draft](/writings/target)', '2026-10-23', true);

test('backlinks combine both extensions once and preserve newest-first public metadata', async (t) => {
  t.mock.method(console, 'warn', () => {});
  const backlinks = await getBacklinksForPost('target');
  assert.deepEqual(
    backlinks.map((item) => item.slug),
    ['beta', 'alpha']
  );
  assert.equal(backlinks[1].title, 'alpha.mdx');
  assert.equal(backlinks[1].excerpt, 'Description of alpha.mdx');
  assert.equal(
    backlinks[0].published.toISOString(),
    '2026-10-22T00:00:00.000Z'
  );
  assert.deepEqual(await getBacklinksForPost('missing'), []);
});

test('plain Node backlink reads see changed links and newly added writings', async (t) => {
  t.mock.method(console, 'warn', () => {});
  write('beta.mdx', 'No remaining link.', '2026-10-22');
  write('new.mdx', '[New](/writings/target)', '2026-10-23');
  assert.deepEqual(
    (await getBacklinksForPost('target')).map((item) => item.slug),
    ['new', 'alpha']
  );
});
