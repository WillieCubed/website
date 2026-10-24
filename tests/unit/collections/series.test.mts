import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';

const originalCwd = process.cwd();
const root = mkdtempSync(join(tmpdir(), 'series-loader-'));
for (const directory of ['series', 'initiatives', 'writings'])
  mkdirSync(join(root, 'content', directory), { recursive: true });
process.chdir(root);
const series = await import('@/lib/collections');
after(() => {
  process.chdir(originalCwd);
  rmSync(root, { recursive: true, force: true });
});
const file = (slug: string, content: string) =>
  writeFileSync(join(root, 'content/series', slug), content);
const initiative = (slug: string) => {
  mkdirSync(join(root, 'content/initiatives', slug), { recursive: true });
  writeFileSync(
    join(root, 'content/initiatives', slug, 'index.mdx'),
    `---\ntitle: A project\ntagline: The current project.\ndescription: Its full account.\nkind: project\nstatus: complete\n---\nInitiative body.\n`
  );
};

test('a series preserves authored metadata and defaults without a generic collection model', async () => {
  file(
    'authored.md',
    `---\nname: Authored series\ndescription: A collected account.\nstartedAt: '2026-10-01'\ncomplete: true\ncoverImage: /cover.webp\n---\nThe series body.\n`
  );
  assert.deepEqual(await series.getSeries('authored'), {
    slug: 'authored',
    name: 'Authored series',
    description: 'A collected account.',
    startedAt: '2026-10-01',
    complete: true,
    coverImage: '/cover.webp',
    content: 'The series body.\n',
    href: '/writings?series=authored',
  });
  file('defaults.mdx', '---\nname: Default series\n---\nDefault body.\n');
  assert.deepEqual(await series.getSeries('defaults'), {
    slug: 'defaults',
    name: 'Default series',
    description: '',
    startedAt: undefined,
    complete: false,
    coverImage: undefined,
    content: 'Default body.\n',
    href: '/writings?series=defaults',
  });
});

test('an initiative supplies a missing series and owns the link when both exist', async () => {
  initiative('shared');
  const fallback = await series.getSeries('shared');
  assert.equal(fallback.name, 'A project');
  assert.equal(fallback.description, 'Its full account.');
  assert.equal(fallback.complete, true);
  assert.equal(fallback.content, 'Initiative body.\n');
  assert.equal(fallback.href, '/initiatives/shared');
  file(
    'shared.mdx',
    '---\nname: The collection name\ndescription: The collection description.\n---\nCollection body.\n'
  );
  const own = await series.getSeries('shared');
  assert.equal(own.name, 'The collection name');
  assert.equal(own.content, 'Collection body.\n');
  assert.equal(own.href, '/initiatives/shared');
});

test('series loading preserves MDX priority and missing-file errors', async () => {
  file('both.md', '---\nname: Markdown\n---\n');
  file('both.mdx', '---\nname: MDX\n---\n');
  assert.equal((await series.getSeries('both')).name, 'MDX');
  await assert.rejects(
    series.getSeries('absent'),
    /Collection "absent" of type "series" cannot be found/
  );
});

test('series writings retain publication filtering and part-number order', async () => {
  file('ordered.mdx', '---\nname: Ordered\n---\n');
  for (const [slug, part, draft] of [
    ['later', 2, false],
    ['first', 1, false],
    ['private', 3, true],
  ] as const) {
    writeFileSync(
      join(root, 'content/writings', `${slug}.mdx`),
      `---\ntitle: ${slug}\npublished: '2026-10-23'\ndraft: ${draft}\nseries:\n  slug: ordered\n  part: ${part}\n---\nA writing.\n`
    );
  }
  const result = await series.getSeriesWithWritings('ordered');
  const expected =
    process.env.SITE_MODE === 'preview'
      ? ['first', 'later', 'private']
      : ['first', 'later'];
  assert.deepEqual(
    result.writings.map((writing) => writing.slug),
    expected
  );
  assert.equal(result.totalParts, expected.length);
});

test('initiative fallback honors hidden and draft visibility without a series directory', async () => {
  rmSync(join(root, 'content/series'), { recursive: true });
  initiative('_hidden');
  await assert.rejects(series.getSeries('_hidden'), /cannot be found/);
  initiative('unpublished');
  writeFileSync(
    join(root, 'content/initiatives/unpublished/index.mdx'),
    '---\ntitle: Private project\ntagline: Private.\ndescription: Private account.\nkind: project\ndraft: true\n---\nPrivate body.\n'
  );
  if (process.env.SITE_MODE === 'preview') {
    assert.equal(
      (await series.getSeries('unpublished')).href,
      '/initiatives/unpublished'
    );
  } else {
    await assert.rejects(series.getSeries('unpublished'), /cannot be found/);
  }
});

test('a series reads only its matching initiative instead of parsing unrelated content', async () => {
  mkdirSync(join(root, 'content/initiatives/broken'), { recursive: true });
  writeFileSync(
    join(root, 'content/initiatives/broken/index.mdx'),
    '---\ntitle: [invalid\n---\n'
  );
  assert.equal((await series.getSeries('shared')).href, '/initiatives/shared');
});
