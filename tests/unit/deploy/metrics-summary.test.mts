import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { writeMetricsSummary } from '../../../scripts/cloudflare/metrics-summary.mts';

const counts = {
  expected: 2,
  attempted: 2,
  valid: 1,
  failed: 1,
  unavailable: 0,
  missing: 0,
};
const byCategory = {
  html: 100,
  rsc: 20,
  js: 30,
  css: 40,
  images: 50,
  json: 60,
  other: 0,
};
const route = {
  status: 'failed',
  counts,
  ttfbMs: 10,
  fcpMs: null,
  lcpMs: null,
  cls: 0,
  metricSamples: { ttfbMs: 1, fcpMs: 0, lcpMs: 0, cls: 1 },
  transfers: {
    cold: [
      {
        bytes: 370,
        byCategory,
        prefetch: {
          bytes: 70,
          byCategory: {
            ...byCategory,
            html: 0,
            rsc: 70,
            js: 0,
            css: 0,
            images: 0,
            json: 0,
          },
        },
        pending: 1,
        unanswered: 0,
        failed: [],
      },
    ],
  },
};

test('the persisted CI summary reports failures, missing metrics and actual transfer categories separately from build sizes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'website-metrics-summary-'));
  try {
    await mkdir(join(directory, 'artifacts'));
    await writeFile(
      join(directory, 'artifacts/cloudflare-build-metrics.json'),
      JSON.stringify({
        revision: 'abc123',
        buildMs: 1200,
        workerBytes: 1048576,
        staticAssetBytes: 2097152,
        staticAssetFiles: 5,
        sourceLines: 100,
      })
    );
    await writeFile(
      join(directory, 'artifacts/cloudflare-preview-metrics.json'),
      JSON.stringify({
        status: 'failed',
        samplesPerRoute: 2,
        routes: { '/search': route },
        journeys: {},
        journeyCounts: {},
        privateRoutes: {
          '/studio': {
            ...route,
            status: 'unavailable',
            counts: {
              ...counts,
              attempted: 0,
              valid: 0,
              failed: 0,
              missing: 2,
            },
          },
        },
        screenshots: {
          status: 'valid',
          captured: 4,
          expected: 4,
          manifest: 'artifacts/cloudflare-preview-screenshots/manifest.json',
        },
      })
    );
    const summaryPath = join(directory, 'summary.md');
    await writeMetricsSummary({
      root: directory,
      summaryPath,
      repositoryUrl: 'https://github.com/example/website',
      runUrl: 'https://github.com/example/website/actions/runs/123',
    });
    const summary = await readFile(summaryPath, 'utf8');
    assert.match(summary, /Measurement status: \*\*failed\*\*/);
    assert.match(
      summary,
      /\| `\/search` \| cold \| failed \| 1\/2 \| 2 \| 1 \| 0 \| 0 \|/
    );
    assert.match(summary, /n\/a/);
    assert.doesNotMatch(summary, /\bnull\b/);
    assert.match(
      summary,
      /\| `\/search` \| cold \| 1\/2 \| 370 \| 100 \| 20 \| 30 \| 40 \| 50 \| 60 \| 0 \| 70 \| 1 \|/
    );
    assert.match(summary, /Prefetch bytes/);
    assert.match(
      summary,
      /\| `\/search` \| cold \| 1\/2 \| 70 \| 0 \| 70 \| 0 \| 0 \| 0 \| 0 \| 0 \|/
    );
    assert.match(summary, /Worker output: 1.00 MiB/);
    assert.match(summary, /cloudflare-preview-screenshots/);
    assert.match(summary, /actions\/runs\/123#artifacts/);
    assert.match(summary, /unavailable/);
    const legacy = {
      status: 'valid',
      samplesPerRoute: 2,
      routes: { '/search': { ...route, status: 'valid' } },
      journeys: {},
      journeyCounts: {},
    };
    await writeFile(
      join(directory, 'artifacts/cloudflare-preview-metrics.json'),
      JSON.stringify(legacy)
    );
    const incompletePath = join(directory, 'incomplete.md');
    await writeMetricsSummary({
      root: directory,
      summaryPath: incompletePath,
      repositoryUrl: 'https://github.com/example/website',
      runUrl: 'https://github.com/example/website/actions/runs/123',
    });
    const incomplete = await readFile(incompletePath, 'utf8');
    assert.match(incomplete, /failed \(incomplete measurements\)/);
    assert.match(incomplete, /\| `\/search` \| cold \| incomplete \|/);
    await rm(join(directory, 'artifacts/cloudflare-preview-metrics.json'));
    const missingPath = join(directory, 'missing.md');
    await writeMetricsSummary({
      root: directory,
      summaryPath: missingPath,
      repositoryUrl: 'https://github.com/example/website',
      runUrl: 'https://github.com/example/website/actions/runs/123',
    });
    assert.match(
      await readFile(missingPath, 'utf8'),
      /browser report is missing/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
