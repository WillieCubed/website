import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  collectBuildMetrics,
  countSourceLines,
} from '../../../scripts/cloudflare/build-metrics.mts';

test('build metrics count Worker and nested static asset bytes separately', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cloudflare-build-metrics-'));
  try {
    await mkdir(join(root, '.open-next/assets/nested'), { recursive: true });
    await writeFile(join(root, '.open-next/worker.js'), 'worker');
    await mkdir(join(root, 'wrangler-output'), { recursive: true });
    await writeFile(join(root, 'wrangler-output/worker.js'), 'bundled-worker');
    await writeFile(join(root, '.open-next/assets/index.html'), 'html!');
    await writeFile(join(root, '.open-next/assets/nested/app.js'), 'bundle');

    const metrics = await collectBuildMetrics({
      root,
      revision: 'abc123',
      buildMs: 456,
      trackedFiles: [],
      workerBundlePath: join(root, 'wrangler-output/worker.js'),
    });

    assert.equal(metrics.workerBytes, 14);
    assert.equal(metrics.staticAssetBytes, 11);
    assert.equal(metrics.staticAssetFiles, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('source LOC counts only tracked TypeScript, TSX, and CSS source files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cloudflare-source-lines-'));
  try {
    const files = {
      'app/page.ts': 'one\ntwo\n',
      'app/view.tsx': 'three\n',
      'components/site.css': 'four\nfive\n',
      'components/test.test.tsx': 'ignored test\n',
      'lib/content/generated-content.ts': 'generated content\n',
      'lib/mdx/generated.tsx': 'generated\n',
      'lib/readme.md': 'not code\n',
      'scripts/not-counted.ts': 'outside roots\n',
    };
    for (const [path, content] of Object.entries(files)) {
      const fullPath = join(root, path);
      await mkdir(join(fullPath, '..'), { recursive: true });
      await writeFile(fullPath, content);
    }
    await mkdir(join(root, 'components'), { recursive: true });
    await writeFile(join(root, 'components/untracked.ts'), 'untracked\n');

    assert.equal(await countSourceLines(root, Object.keys(files)), 5);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('metrics collection rejects a missing Worker output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cloudflare-metrics-missing-'));
  try {
    await assert.rejects(
      collectBuildMetrics({
        root,
        revision: 'abc123',
        buildMs: 0,
        trackedFiles: [],
        workerBundlePath: join(root, 'wrangler-output/worker.js'),
      }),
      /Cloudflare Worker bundle output is missing/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
