import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';

const originalCwd = process.cwd();
const fixtureRoot = mkdtempSync(join(tmpdir(), 'writing-metadata-'));
mkdirSync(join(fixtureRoot, 'content/writings'), { recursive: true });
process.chdir(fixtureRoot);
const loader = await import('@/lib/writings/load');
after(() => {
  process.chdir(originalCwd);
  rmSync(fixtureRoot, { recursive: true, force: true });
});

const slug = 'metadata-loader-fixture';
const file = join(process.cwd(), 'content/writings', `${slug}.mdx`);
const source = `---\ntitle: Loader fixture\npublished: 2026-10-23T12:00:00Z\ntags: [Test]\ndraft: true\n---\n## A heading\n\nA short article.\n`;

test('metadata reads preserve document fields while omitting body and headings', async () => {
  assert.equal(typeof loader.loadWritingMetadata, 'function');
  assert.equal(typeof loader.loadAllWritingMetadata, 'function');
  writeFileSync(file, source);
  try {
    const metadata = await loader.loadWritingMetadata(slug);
    const document = await loader.loadWriting(slug);
    assert.deepEqual(metadata, document.writing);
    assert.equal(Object.hasOwn(metadata, 'headings'), false);
    assert.equal(Object.hasOwn(metadata, 'content'), false);
    assert.deepEqual(document.headings, [
      { id: 'a-heading', text: 'A heading', level: 2 },
    ]);
    const listed = await loader.loadAllWritingMetadata();
    assert.deepEqual(
      listed.find((item) => item.slug === slug),
      metadata
    );
    assert.equal(metadata.draft, true);
  } finally {
    rmSync(file, { force: true });
  }
});

test('plain Node metadata reads see content changes without a process-wide cache', async () => {
  assert.equal(typeof loader.loadWritingMetadata, 'function');
  writeFileSync(file, source);
  try {
    const first = await loader.loadWritingMetadata(slug);
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace('Loader fixture', 'Changed title')
    );
    const second = await loader.loadWritingMetadata(slug);
    assert.equal(first.title, 'Loader fixture');
    assert.equal(second.title, 'Changed title');
  } finally {
    rmSync(file, { force: true });
  }
});

test('metadata rejects existing hidden and reserved files with the document loader error', async (context) => {
  const warnings = context.mock.method(console, 'warn', () => {});
  for (const hidden of ['_template', 'opengraph-image']) {
    const hiddenFile = join(fixtureRoot, 'content/writings', `${hidden}.mdx`);
    writeFileSync(hiddenFile, source);
    try {
      await assert.rejects(
        loader.loadWritingMetadata(hidden),
        /cannot be found/
      );
      await assert.rejects(loader.loadWriting(hidden), /cannot be found/);
    } finally {
      rmSync(hiddenFile, { force: true });
    }
  }
  assert.ok(warnings.mock.callCount() > 0);
});
