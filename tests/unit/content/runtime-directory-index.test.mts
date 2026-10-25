import assert from 'node:assert/strict';
import test from 'node:test';

import * as manifest from '../../../scripts/cloudflare/generate-content-manifest.mts';

test('the Worker directory index records immediate children and every ancestor once', () => {
  assert.equal(typeof manifest.buildDirectoryIndex, 'function');
  assert.deepEqual(
    manifest.buildDirectoryIndex([
      'content/writings/a.mdx',
      'content/initiatives/tour/index.mdx',
      'content/initiatives/tour/parts/1.mdx',
      'content/writings/b.md',
      'public/search-index.json',
    ]),
    {
      content: [
        ['writings', true],
        ['initiatives', true],
      ],
      'content/writings': [
        ['a.mdx', false],
        ['b.md', false],
      ],
      'content/initiatives': [['tour', true]],
      'content/initiatives/tour': [
        ['index.mdx', false],
        ['parts', true],
      ],
      'content/initiatives/tour/parts': [['1.mdx', false]],
      public: [['search-index.json', false]],
    }
  );
});

test('Worker directory and content reads match local files', async () => {
  const nodeFiles = await import('node:fs');
  const runtime = await import('@/lib/content/runtime-files');
  const { runtimeDirectories } =
    await import('@/lib/content/generated-content');
  const symbol = Symbol.for('__cloudflare-context__');
  const global = globalThis as typeof globalThis & { [symbol]?: unknown };
  const original = global[symbol];
  const directories = ['content', 'content/writings', 'content/initiatives'];
  const expected = directories.map((directory) =>
    nodeFiles.readdirSync(directory, { withFileTypes: true })
  );
  global[symbol] = { env: {} };
  try {
    for (const [index, directory] of directories.entries()) {
      assert.ok(runtime.existsSync(directory));
      assert.deepEqual(
        runtime.readdirSync(directory),
        expected[index].map((entry) => entry.name)
      );
      assert.deepEqual(
        runtime
          .readdirSync(directory, { withFileTypes: true })
          .map((entry) => [entry.name, entry.isDirectory(), entry.isFile()]),
        expected[index].map((entry) => [
          entry.name,
          entry.isDirectory(),
          entry.isFile(),
        ])
      );
      assert.deepEqual(
        runtimeDirectories[directory].map(([name]) => name),
        expected[index].map((entry) => entry.name)
      );
    }
    const file = 'content/writings/_template.mdx';
    assert.equal(
      runtime.readFileSync(file, 'utf8'),
      nodeFiles.readFileSync(file, 'utf8')
    );
    assert.equal(runtime.existsSync('content/absent'), false);
    assert.throws(
      () => runtime.readdirSync('content/absent'),
      /Runtime content directory missing/
    );
    assert.throws(
      () => runtime.readFileSync('content/absent.mdx'),
      /Runtime content file missing/
    );
  } finally {
    if (original === undefined) delete global[symbol];
    else global[symbol] = original;
  }
});

test('the directory index preserves filesystem order for numeric slugs', () => {
  const directories = manifest.buildDirectoryIndex([
    'content/initiatives/10/index.mdx',
    'content/initiatives/2/index.mdx',
  ]);
  assert.deepEqual(
    directories['content/initiatives'].map(([name]) => name),
    ['10', '2']
  );
});
