import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  isMain,
  repositoryRoot,
  sourceManifest,
} from '../../../support/publishing/runtime.mts';

test('test support paths are rooted at the checkout rather than the caller cwd', () => {
  assert.equal(repositoryRoot, process.cwd());
  assert.equal(
    isMain(
      new URL('../../../support/publishing/runtime.mts', import.meta.url).href
    ),
    false
  );
});

test('source manifests bind local static and dynamic modules without executing them', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'source-manifest-'));
  try {
    await mkdir(join(dir, 'parts'));
    await writeFile(
      join(dir, 'run.mts'),
      "import './parts/a.mts';\nawait import('./parts/b.mts');\n"
    );
    await writeFile(
      join(dir, 'parts/a.mts'),
      "import '../run.mts';\nthrow new Error('must not execute');\n"
    );
    await writeFile(join(dir, 'parts/b.mts'), 'export const value = 1;\n');
    const first = await sourceManifest(join(dir, 'run.mts'), dir);
    assert.deepEqual(Object.keys(first), [
      'parts/a.mts',
      'parts/b.mts',
      'run.mts',
    ]);
    assert.equal(
      first['parts/a.mts'],
      createHash('sha256')
        .update(await readFile(join(dir, 'parts/a.mts')))
        .digest('hex')
    );
    await writeFile(join(dir, 'parts/b.mts'), 'export const value = 2;\n');
    const second = await sourceManifest(join(dir, 'run.mts'), dir);
    assert.notEqual(second['parts/b.mts'], first['parts/b.mts']);
    assert.equal(second['run.mts'], first['run.mts']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a manifest refuses a source dependency outside its checkout', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'source-boundary-'));
  try {
    const root = join(dir, 'repo');
    await mkdir(root);
    await writeFile(join(dir, 'outside.mts'), '');
    await symlink(join(dir, 'outside.mts'), join(root, 'linked.mts'));
    await writeFile(join(root, 'run.mts'), "import './linked.mts';");
    await assert.rejects(
      sourceManifest(join(root, 'run.mts'), root),
      /outside/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('command entrypoints can be imported without starting provider operations', async () => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execute = promisify(execFile);
  const scripts = [
    'atproto-social-capture',
    'atproto-hosted-responses',
    'atproto-acceptance-identities',
    'standard-site-acceptance',
    'bluesky-acceptance',
    'atproto-social-acceptance',
    'atproto-refresh-acceptance',
    'atproto-overlap-acceptance',
    'websub-acceptance',
    'indieweb-feed-media-verify',
    'indieweb-media-browser-verify',
    'publishing-acceptance-setup',
    'atproto-provider-token-inventory',
    'cloudflare/build',
    'cloudflare/deploy',
    'cloudflare/generate-content-manifest',
    'cloudflare/package-runtime',
    'cloudflare/prepare-secrets',
    'cloudflare/check-neon-free',
    'cloudflare/generate-mdx',
    'cloudflare/verify-public-routes',
    'music/migrate',
    'music/migrate-shared-key',
    'music/provision',
    'studio/build-runtime',
    'studio/import-drafts',
    'studio/migrate',
  ];
  const code = `const child = await import('node:child_process'); for (const key of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync']) child.default[key] = () => { throw new Error('Unexpected subprocess operation'); }; (await import('node:module')).syncBuiltinESMExports(); process.argv = [process.execPath, 'offline-import-check', '--must-not-run']; globalThis.fetch = async () => { throw new Error('Unexpected network operation'); }; await Promise.all(${JSON.stringify(scripts)}.map(name => import('./scripts/' + name + '.mts'))); const net = await import('node:net'); net.default.createServer = () => { throw new Error('Unexpected listener'); }; (await import('node:module')).syncBuiltinESMExports(); await import('./scripts/atproto-acceptance-smtp.mjs'); await import('./scripts/studio-e2e.mjs'); console.log('imported');`;
  const { stdout, stderr } = await execute(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '--eval', code],
    { timeout: 30_000 }
  );
  assert.equal(stdout.trim(), 'imported');
  assert.equal(stderr, '');
});

test('legacy commands retain source manifests for the test implementations they execute', async () => {
  const commands = [
    ['atproto-social-capture', 'tests/e2e/publishing/atproto/capture/run.mts'],
    [
      'atproto-hosted-responses',
      'tests/e2e/publishing/atproto/responses/run.mts',
    ],
    ['standard-site-acceptance', 'tests/e2e/publishing/standard-site/run.mts'],
    ['bluesky-acceptance', 'tests/e2e/publishing/atproto/bluesky.mts'],
    ['atproto-social-acceptance', 'tests/e2e/publishing/atproto/social.mts'],
    ['atproto-refresh-acceptance', 'tests/e2e/publishing/atproto/refresh.mts'],
    ['atproto-overlap-acceptance', 'tests/e2e/publishing/atproto/overlap.mts'],
    ['websub-acceptance', 'tests/e2e/publishing/websub/run.mts'],
    [
      'indieweb-feed-media-verify',
      'tests/e2e/publishing/indieweb/feed-media.mts',
    ],
    [
      'indieweb-media-browser-verify',
      'tests/e2e/publishing/indieweb/media-browser.mts',
    ],
  ];
  for (const [command, implementation] of commands) {
    const entrypoint = `scripts/${command}.mts`;
    const manifest = await sourceManifest(join(repositoryRoot, entrypoint));
    assert(manifest[entrypoint], 'The command entrypoint is retained.');
    assert.equal(
      manifest[implementation],
      createHash('sha256')
        .update(await readFile(join(repositoryRoot, implementation)))
        .digest('hex')
    );
  }
});

test('cleanup source provenance preserves the original verification manifest and old receipt shape', async () => {
  const { bindSourceManifest } =
    await import('../../../support/publishing/runtime.mts');
  assert.equal(typeof bindSourceManifest, 'function');
  const dir = await mkdtemp(join(tmpdir(), 'receipt-provenance-'));
  const source = join(dir, 'run.mts');
  const receipt: {
    verifierSourceFiles?: Record<string, string>;
    cleanupSourceFiles?: Record<string, string>;
  } = {};
  try {
    await writeFile(source, 'export const revision = 1;');
    await bindSourceManifest(receipt, source, 'verification', dir);
    const original = structuredClone(receipt.verifierSourceFiles);
    await writeFile(source, 'export const revision = 2;');
    await bindSourceManifest(receipt, source, 'verification', dir);
    assert.deepEqual(receipt.verifierSourceFiles, original);
    await bindSourceManifest(receipt, source, 'cleanup', dir);
    assert.deepEqual(receipt.verifierSourceFiles, original);
    assert.notDeepEqual(receipt.cleanupSourceFiles, original);
    const legacy: typeof receipt = {};
    await bindSourceManifest(legacy, source, 'cleanup', dir);
    assert.equal(Object.hasOwn(legacy, 'verifierSourceFiles'), false);
    assert.deepEqual(legacy.cleanupSourceFiles, receipt.cleanupSourceFiles);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the hosted runner waits for validation failure handling before resolving', async () => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execute = promisify(execFile);
  const dir = await mkdtemp(join(tmpdir(), 'hosted-validation-'));
  try {
    const code = `process.argv = [process.execPath, 'offline-validation', '--env', ${JSON.stringify(join(dir, 'missing.env'))}, '--receipt', ${JSON.stringify(join(dir, 'receipt.json'))}]; globalThis.fetch = async () => { throw new Error('Unexpected network operation'); }; const { runHostedResponses } = await import(${JSON.stringify(new URL('../../../e2e/publishing/atproto/responses/run.mts', import.meta.url).href)}); await runHostedResponses(); console.log('resolved:' + process.exitCode);`;
    let output = '';
    try {
      const child = join(dir, 'validation.mts');
      await writeFile(child, code);
      await execute(process.execPath, ['--import', 'tsx', child], {
        timeout: 30_000,
      });
      assert.fail('Invalid input must fail the command.');
    } catch (error) {
      const failure = error as Error & {
        code?: number;
        stdout?: string;
        stderr?: string;
      };
      assert.equal(failure.code, 1);
      assert.match(
        failure.stderr ?? '',
        /Hosted Atmosphere verification failed/
      );
      output = failure.stdout ?? '';
    }
    assert.equal(output.trim(), 'resolved:1');
    await assert.rejects(stat(join(dir, 'receipt.json')), { code: 'ENOENT' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('capture provenance includes separately executed publishing test implementations', async () => {
  const { captureSourceManifest } =
    await import('../../../e2e/publishing/atproto/capture/sources.mts');
  const manifest = await captureSourceManifest();
  for (const path of [
    'tests/e2e/publishing/atproto/refresh.mts',
    'tests/e2e/publishing/atproto/social.mts',
    'tests/e2e/publishing/atproto/bluesky.mts',
    'tests/e2e/publishing/atproto/responses/run.mts',
    'tests/e2e/publishing/standard-site/run.mts',
    'scripts/atproto/sync.mts',
  ])
    assert.equal(
      manifest[path],
      createHash('sha256')
        .update(await readFile(join(repositoryRoot, path)))
        .digest('hex')
    );
});
