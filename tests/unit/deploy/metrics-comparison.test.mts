import assert from 'node:assert/strict';
import test from 'node:test';

import { formatMetricsComparison } from '../../../scripts/cloudflare/metrics-comparison.mts';
import type { PreviewReport } from '../../../scripts/cloudflare/metrics-summary.mts';

function report(bytes: number, js: number, prefetch: number): PreviewReport {
  const counts = {
    expected: 1,
    attempted: 1,
    valid: 1,
    failed: 0,
    unavailable: 0,
    missing: 0,
  };
  const categories = {
    html: 100,
    rsc: 0,
    js,
    css: 0,
    images: 0,
    json: 0,
    other: 0,
  };
  const transfer = {
    bytes,
    byCategory: categories,
    prefetch: {
      bytes: prefetch,
      byCategory: { ...categories, html: 0, js: 0, rsc: prefetch },
    },
    pending: 1,
    unanswered: 0,
    settlement: { status: 'quiet' },
  };
  const route = {
    status: 'valid',
    counts,
    ttfbMs: 10,
    fcpMs: 20,
    lcpMs: 30,
    cls: 0,
  };
  return {
    revision: 'fixture',
    status: 'valid',
    samplesPerRoute: 1,
    routes: {
      '/search': {
        ...route,
        warm: route,
        transfers: { cold: [transfer], warm: [transfer] },
      },
    },
    journeys: { discover: [{ steps: [{ path: '/search', transfer }] }] },
    journeyCounts: { discover: { ...counts, status: 'valid' } },
  };
}

test('baseline comparisons use exact visitor transfer differences for cold, warm and journey windows', () => {
  const summary = formatMetricsComparison(
    report(500, 300, 100),
    report(380, 200, 80)
  );
  assert.match(
    summary,
    /\| `\/search` \| cold \| delta \| -120 \| 0 \| 0 \| -100 \|/
  );
  assert.match(summary, /\| `\/search` \| warm \| delta \| -120/);
  assert.match(summary, /\| `discover: \/search` \| journey \| delta \| -120/);
  assert.match(summary, /Prefetch comparison/);
  assert.match(summary, /\| `\/search` \| cold \| delta \| -20 \| 0 \| -20/);
  assert.doesNotMatch(summary, /Worker/);
});

test('failed, missing and broken image windows cannot be presented as bandwidth savings', () => {
  const current = report(0, 0, 0);
  current.routes['/search']!.status = 'failed';
  current.routes['/search']!.counts.valid = 0;
  current.routes['/search']!.counts.failed = 1;
  const failed = formatMetricsComparison(report(500, 300, 100), current);
  assert.match(failed, /\| `\/search` \| cold \| delta \| n\/a/);
  const absent = report(500, 300, 100);
  absent.routes = {};
  assert.match(
    formatMetricsComparison(report(500, 300, 100), absent),
    /missing/
  );
  const broken = report(0, 0, 0);
  broken.routes['/search']!.transfers!.cold[0]!.failed = [
    { category: 'images' },
  ];
  assert.match(
    formatMetricsComparison(report(500, 300, 100), broken),
    /\| `\/search` \| cold \| delta \| n\/a/
  );
});
