import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { performance } from 'node:perf_hooks';

import { isMain } from '../shared/command.mts';

export interface CloudflareBuildMetrics {
  revision: string;
  buildMs: number;
  workerBytes: number;
  staticAssetBytes: number;
  staticAssetFiles: number;
  sourceLines: number;
}

interface CollectBuildMetricsOptions {
  root?: string;
  revision: string;
  buildMs: number;
  trackedFiles?: string[];
  workerBundlePath: string;
}

const SOURCE_ROOTS = ['app/', 'components/', 'lib/'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.css']);
const GENERATED_SOURCE_FILES = new Set([
  'lib/content/generated-content.ts',
  'lib/mdx/generated.tsx',
]);

function isSourceFile(path: string): boolean {
  const extension = path.slice(path.lastIndexOf('.'));
  return (
    SOURCE_ROOTS.some((root) => path.startsWith(root)) &&
    SOURCE_EXTENSIONS.has(extension) &&
    !GENERATED_SOURCE_FILES.has(path) &&
    !path.includes('/__tests__/') &&
    !/\.(?:test|spec)\.(?:ts|tsx)$/.test(path)
  );
}

export async function countSourceLines(
  root: string,
  trackedFiles: string[]
): Promise<number> {
  const files = trackedFiles.filter(isSourceFile);
  const counts = await Promise.all(
    files.map(async (path) => {
      const contents = await readFile(join(root, path), 'utf8');
      if (contents.length === 0) return 0;
      return contents.split(/\r?\n/).length - (contents.endsWith('\n') ? 1 : 0);
    })
  );
  return counts.reduce((total, count) => total + count, 0);
}

async function measureStaticAssets(directory: string) {
  let bytes = 0;
  let files = 0;
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await measureStaticAssets(path);
      bytes += nested.bytes;
      files += nested.files;
    } else if (entry.isFile()) {
      bytes += (await stat(path)).size;
      files += 1;
    }
  }
  return { bytes, files };
}

export async function collectBuildMetrics({
  root = process.cwd(),
  revision,
  buildMs,
  trackedFiles,
  workerBundlePath,
}: CollectBuildMetricsOptions): Promise<CloudflareBuildMetrics> {
  try {
    const worker = await stat(workerBundlePath);
    if (!worker.isFile()) throw new Error('Not a file');
  } catch {
    throw new Error('Cloudflare Worker bundle output is missing.');
  }

  const assetDirectory = join(root, '.open-next/assets');
  let assets: { bytes: number; files: number };
  try {
    assets = await measureStaticAssets(assetDirectory);
  } catch {
    throw new Error('Cloudflare build output is missing .open-next/assets.');
  }

  const files =
    trackedFiles ??
    execFileSync('git', ['ls-files', '-z', '--', 'app', 'components', 'lib'], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\0')
      .filter(Boolean);

  return {
    revision,
    buildMs,
    workerBytes: (await stat(workerBundlePath)).size,
    staticAssetBytes: assets.bytes,
    staticAssetFiles: assets.files,
    sourceLines: await countSourceLines(root, files),
  };
}

export async function runCloudflareBuildWithMetrics() {
  const root = process.cwd();
  const startedAt = performance.now();
  const build = spawnSync('pnpm', ['build:cloudflare'], {
    cwd: root,
    stdio: 'inherit',
  });
  if (build.error) throw build.error;
  if (build.status !== 0) {
    throw new Error(
      `Cloudflare build exited with status ${build.status ?? 1}.`
    );
  }
  const buildMs = Math.round(performance.now() - startedAt);

  const bundleDirectory = await mkdtemp(
    join(tmpdir(), 'cloudflare-worker-bundle-')
  );
  let metrics: CloudflareBuildMetrics;
  try {
    const bundle = spawnSync(
      'pnpm',
      [
        'exec',
        'wrangler',
        'deploy',
        '.open-next/worker.js',
        '--dry-run',
        '--experimental-new-config',
        '--outdir',
        bundleDirectory,
        '--metafile',
      ],
      { cwd: root, stdio: 'inherit' }
    );
    if (bundle.error) throw bundle.error;
    if (bundle.status !== 0) {
      throw new Error(
        `Wrangler bundle check exited with status ${bundle.status ?? 1}.`
      );
    }

    metrics = await collectBuildMetrics({
      root,
      revision: execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).trim(),
      buildMs,
      workerBundlePath: join(bundleDirectory, 'worker.js'),
    });
  } finally {
    await rm(bundleDirectory, { recursive: true, force: true });
  }
  const outputPath = join(root, 'artifacts/cloudflare-build-metrics.json');
  await mkdir(join(root, 'artifacts'), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(`Cloudflare build metrics: ${relative(root, outputPath)}`);
  return metrics;
}

if (isMain(import.meta.url)) await runCloudflareBuildWithMetrics();
