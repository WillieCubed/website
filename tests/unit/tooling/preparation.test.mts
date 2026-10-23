import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { prepareArtifact } from '../../../scripts/shared/preparation.mts';

test('preparation reuses bytes only while sources, tools, config, and outputs match', async () => {
  const root = await mkdtemp(join(tmpdir(), 'site-preparation-'));
  try {
    await mkdir(join(root, 'source'));
    await writeFile(join(root, 'source/post.mdx'), 'first');
    await writeFile(join(root, 'config.json'), '{}');
    await writeFile(join(root, 'tool-version'), '1');
    let runs = 0;
    const prepare = () =>
      prepareArtifact({
        root,
        name: 'fixture',
        inputs: ['source', 'config.json', 'tool-version'],
        outputs: ['output'],
        generate: async () => {
          runs++;
          await mkdir(join(root, 'output'), { recursive: true });
          await writeFile(join(root, 'output/index.js'), `build ${runs}`);
        },
      });
    await prepare();
    await prepare();
    assert.equal(runs, 1);
    for (const path of ['source/post.mdx', 'config.json', 'tool-version']) {
      await writeFile(join(root, path), 'changed');
      await prepare();
    }
    assert.equal(runs, 4);
    await writeFile(join(root, 'source/added.mdx'), 'new');
    await prepare();
    await rm(join(root, 'source/added.mdx'));
    await prepare();
    assert.equal(runs, 6);
    await rm(join(root, 'output/index.js'));
    await prepare();
    assert.equal(runs, 7);
    await writeFile(join(root, 'output/index.js'), 'stale');
    await prepare();
    assert.equal(runs, 8);
    assert.equal(
      await readFile(join(root, 'output/index.js'), 'utf8'),
      'build 8'
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('failed or incomplete generation cannot seed the reuse cache', async () => {
  const root = await mkdtemp(join(tmpdir(), 'site-preparation-'));
  try {
    const options = { root, name: 'fixture', inputs: [], outputs: ['missing'] };
    await assert.rejects(
      prepareArtifact({ ...options, generate: async () => {} }),
      /missing/i
    );
    await assert.rejects(
      prepareArtifact({
        ...options,
        generate: async () => {
          throw new Error('failed');
        },
      }),
      /failed/
    );
    let runs = 0;
    const generate = async () => {
      runs++;
      await writeFile(join(root, 'missing'), 'ready');
    };
    await prepareArtifact({ ...options, generate });
    await prepareArtifact({ ...options, generate });
    assert.equal(runs, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('build identity alone reuses preparation while mode, origin and publishing settings invalidate it', async () => {
  const { preparationConfiguration } =
    await import('../../../scripts/shared/preparation.mts');
  const root = await mkdtemp(join(tmpdir(), 'site-preparation-env-'));
  try {
    const env = {
      SITE_BUILT_AT: 'first',
      SITE_BUILD_RECORD: 'first',
      NEXT_PUBLIC_SITE_REVISION: 'first',
      SITE_MODE: 'public',
      NEXT_PUBLIC_SITE_ORIGIN: 'https://example.test',
      SITE_PUBLISHING_BRANCH: 'main',
    };
    let runs = 0;
    const prepare = () =>
      prepareArtifact({
        root,
        name: 'env',
        inputs: [],
        outputs: ['output'],
        configuration: preparationConfiguration(env),
        generate: async () => {
          runs++;
          await writeFile(join(root, 'output'), String(runs));
        },
      });
    await prepare();
    Object.assign(env, {
      SITE_BUILT_AT: 'second',
      SITE_BUILD_RECORD: 'second',
      NEXT_PUBLIC_SITE_REVISION: 'second',
    });
    await prepare();
    assert.equal(runs, 1);
    for (const key of [
      'SITE_MODE',
      'NEXT_PUBLIC_SITE_ORIGIN',
      'SITE_PUBLISHING_BRANCH',
    ] as const) {
      env[key] = 'changed';
      await prepare();
    }
    assert.equal(runs, 4);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
