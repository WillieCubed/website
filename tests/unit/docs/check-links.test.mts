import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  checkMarkdownLinks,
  maintainedMarkdownFiles,
} from '../../../scripts/docs/check-links.mts';

async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'website-doc-links-'));
  for (const [file, content] of Object.entries(files)) {
    await mkdir(join(root, file, '..'), { recursive: true });
    await writeFile(join(root, file), content);
  }
  return root;
}

test('rejects missing files and anchors with their source line', async () => {
  const root = await fixture({
    'README.md': '# Start\n[missing](missing.md)\n[anchor](other.md#absent)\n',
    'other.md': '# Present\n',
  });
  try {
    const issues = await checkMarkdownLinks(root, ['README.md', 'other.md']);
    assert.deepEqual(
      issues.map(({ line, message }) => [line, message]),
      [
        [2, 'Missing local target: missing.md'],
        [3, 'Missing anchor "absent" in other.md'],
      ]
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('accepts references, duplicate headings, encoded paths, root paths and HTML anchors', async () => {
  const root = await fixture({
    'README.md':
      '# Start\n[reference][target]\n[target]: guide%20name.md#hello-world-1\n[explicit](guide%20name.md#retained)\n[local](#start)\n[root](/assets/image.svg?raw=1)\n[directory](nested/)\n[web](https://example.com/no-check)\n`[code](missing.md)`\n\n```md\n[example](missing.md)\n```\n',
    'guide name.md':
      '# Hello, *world*!\n# Hello, world!\n<a id="retained"></a>\n',
    'assets/image.svg': '<svg/>',
    'nested/README.md': '# Nested\n',
  });
  try {
    assert.deepEqual(
      await checkMarkdownLinks(root, ['README.md', 'guide name.md']),
      []
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the command fails broken fixtures and passes valid fixtures', async () => {
  const root = await fixture({ 'README.md': '[broken](absent.md)\n' });
  const command = resolve('node_modules/.bin/tsx');
  const script = resolve('scripts/docs/check-links.mts');
  try {
    const broken = spawnSync(command, [script, 'README.md'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(broken.status, 1);
    assert.match(broken.stderr, /README.md:1: Missing local target: absent.md/);
    await writeFile(join(root, 'README.md'), '# Present\n[valid](#present)\n');
    const valid = spawnSync(command, [script, 'README.md'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /local links and anchors passed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('discovery excludes ignored, historical and deleted files', async () => {
  const root = await fixture({
    '.gitignore': '.cache/\n',
    'README.md': '# Start\n[directory](assets/)\n',
    'assets/image.svg': '<svg/>',
    '.cache/broken.md': '[broken](missing.md)',
    'docs/plans/plan.md': '[broken](missing.md)',
    'docs/2026-10-23-receipt.md': '[broken](missing.md)',
    'removed.md': '[broken](missing.md)',
  });
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['add', 'removed.md'], { cwd: root });
    await rm(join(root, 'removed.md'));
    assert.deepEqual(maintainedMarkdownFiles(root), ['README.md']);
    assert.deepEqual(await checkMarkdownLinks(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
