import { appendFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { isMain } from '../shared/command.mts';
import type { CloudflareBuildMetrics } from './build-metrics.mts';
import { formatMetricsComparison } from './metrics-comparison.mts';
import { median } from './preview-measurement.mts';
import type { TransferCategory } from './preview-transfers.mts';

export interface SampleCounts {
  expected: number;
  attempted: number;
  valid: number;
  failed: number;
  unavailable: number;
  missing: number;
}
type TimingMetric = 'ttfbMs' | 'fcpMs' | 'lcpMs' | 'cls';
export interface Transfer {
  bytes: number;
  byCategory: Record<TransferCategory, number>;
  prefetch: { bytes: number; byCategory: Record<TransferCategory, number> };
  pending: number;
  unanswered?: number;
  settlement?: { status: string };
  failed?: { category?: TransferCategory }[];
}
interface RouteReport {
  status: string;
  counts: SampleCounts;
  ttfbMs: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number | null;
  metricSamples?: Partial<Record<TimingMetric, number>>;
  reason?: string;
  warm?: RouteReport;
  transfers?: { cold: Transfer[]; warm: Transfer[] };
}
interface JourneyRun {
  steps: { path: string; transfer: Transfer }[];
}
export interface PreviewReport {
  reason?: string;
  revision?: string;
  status: string;
  scope?: string;
  samplesPerRoute: number;
  routes: Record<string, RouteReport>;
  privateRoutes?: Record<string, RouteReport>;
  journeys?: Record<string, JourneyRun[]>;
  journeyCounts?: Record<string, SampleCounts & { status: string }>;
  screenshots?: {
    status: string;
    captured: number;
    expected: number;
    manifest: string;
  };
}
interface SummaryOptions {
  baselineDirectory?: string;
  root: string;
  summaryPath: string;
  repositoryUrl: string;
  runUrl: string;
}
interface Phase {
  name: string;
  visit: string;
  metrics: RouteReport;
  transfers: Transfer[];
}
interface TransferRow {
  name: string;
  visit: string;
  expected: number;
  transfers: Transfer[];
}
const CATEGORIES: TransferCategory[] = [
  'html',
  'rsc',
  'js',
  'css',
  'images',
  'json',
  'other',
];
const TIMINGS: TimingMetric[] = ['ttfbMs', 'fcpMs', 'lcpMs', 'cls'];

function number(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  return value.toLocaleString('en-US', { maximumFractionDigits: 5 });
}
function countsCells(counts: SampleCounts): string[] {
  return [
    `${counts.valid}/${counts.expected}`,
    String(counts.attempted),
    String(counts.failed),
    String(counts.unavailable),
    String(counts.missing),
  ];
}
function routePhases(
  routes: Record<string, RouteReport>,
  prefix = ''
): Phase[] {
  return Object.entries(routes).flatMap(([name, metrics]) => {
    const cold = {
      name: prefix + name,
      visit: 'cold',
      metrics,
      transfers: metrics.transfers?.cold ?? [],
    };
    if (!metrics.warm) return [cold];
    return [
      cold,
      {
        name: prefix + name,
        visit: 'warm',
        metrics: metrics.warm,
        transfers: metrics.transfers?.warm ?? [],
      },
    ];
  });
}
function phaseStatus(metrics: RouteReport): string {
  if (metrics.status !== 'valid') return metrics.status;
  const missing = TIMINGS.some(
    (metric) =>
      metrics[metric] === null ||
      !Number.isFinite(metrics[metric]) ||
      metrics.metricSamples?.[metric] === 0
  );
  return missing || metrics.counts.valid !== metrics.counts.expected
    ? 'incomplete'
    : 'valid';
}
function timingRow(phase: Phase): string {
  const { metrics } = phase;
  const values = TIMINGS.map((metric) => {
    const available = metrics.metricSamples?.[metric] ?? metrics.counts.valid;
    return available === 0 ||
      metrics[metric] === null ||
      !Number.isFinite(metrics[metric])
      ? 'n/a'
      : `${number(metrics[metric])} (n=${available})`;
  });
  return `| \`${phase.name}\` | ${phase.visit} | ${phaseStatus(metrics)} | ${[...countsCells(metrics.counts), ...values].join(' | ')} |`;
}
function transferCells(row: TransferRow, prefetch: boolean): string[] {
  const totals = row.transfers.map((sample) =>
    prefetch ? sample.prefetch : sample
  );
  return [
    number(median(totals.map((sample) => sample.bytes))),
    ...CATEGORIES.map((category) =>
      number(median(totals.map((sample) => sample.byCategory[category])))
    ),
  ];
}
function transferRow(row: TransferRow, prefetch: boolean): string {
  const suffix = prefetch
    ? []
    : [
        number(median(row.transfers.map((sample) => sample.prefetch.bytes))),
        number(median(row.transfers.map((sample) => sample.pending))),
        number(median(row.transfers.map((sample) => sample.unanswered ?? 0))),
      ];
  return `| \`${row.name}\` | ${row.visit} | ${row.transfers.length}/${row.expected} | ${[...transferCells(row, prefetch), ...suffix].join(' | ')} |`;
}
function journeyTransferRows(report: PreviewReport): TransferRow[] {
  const groups = new Map<string, TransferRow>();
  for (const [name, runs] of Object.entries(report.journeys ?? {})) {
    for (const run of runs) {
      for (const step of run.steps) {
        const key = `${name}: ${step.path}`;
        const row = groups.get(key) ?? {
          name: key,
          visit: 'journey',
          expected: report.samplesPerRoute,
          transfers: [],
        };
        row.transfers.push(step.transfer);
        groups.set(key, row);
      }
    }
  }
  return [...groups.values()];
}
function transferTable(rows: TransferRow[]): string[] {
  return [
    'The following medians use actual encoded bytes observed during each window. Ordinary categories exclude prefetch; Total includes prefetch.',
    '',
    '| Route or journey step | Visit | Windows/expected | Total | HTML | RSC | JS | CSS | Images | JSON | Other | Prefetch | Open responses | Unanswered |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map((row) => transferRow(row, false)),
    '',
    '### Prefetch bytes',
    '',
    '| Route or journey step | Visit | Windows/expected | Total | HTML | RSC | JS | CSS | Images | JSON | Other |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows.map((row) => transferRow(row, true)),
    '',
    'Open idle RSC or HTTP error responses remain disclosed. These windows do not claim that every response body finished.',
    '',
  ];
}
function journeyTable(report: PreviewReport): string[] {
  return [
    '### Navigation journeys',
    '',
    '| Journey | Status | Valid/expected | Attempted | Failed | Unavailable | Missing |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ...Object.entries(report.journeyCounts ?? {}).map(
      ([name, counts]) =>
        `| \`${name}\` | ${counts.status} | ${countsCells(counts).join(' | ')} |`
    ),
    '',
  ];
}
function screenshotSummary(report: PreviewReport, runUrl: string): string[] {
  const screenshot = report.screenshots;
  const status = screenshot
    ? `${screenshot.status}; ${screenshot.captured}/${screenshot.expected} viewport captures`
    : 'not requested';
  return [
    '### Review artifacts',
    '',
    `Screenshot evidence: ${status}.`,
    '',
    'The `cloudflare-build-metrics` artifact contains the raw bandwidth and sample reports. The `cloudflare-preview-screenshots` artifact contains 1440×1000 and 390×844 full-viewport captures in both themes plus its manifest.',
    '',
    `[Open this run's downloadable artifacts](${runUrl}#artifacts).`,
    '',
    'These are local preview measurements. Metric budgets are not enforced; failed and unavailable measurements remain explicit.',
    '',
  ];
}
export function formatMetricsSummary(
  build: CloudflareBuildMetrics,
  report: PreviewReport,
  options: SummaryOptions
): string {
  const phases = [
    ...routePhases(report.routes),
    ...routePhases(report.privateRoutes ?? {}, 'private '),
  ];
  const transfers: TransferRow[] = [
    ...phases.map((phase) => ({
      name: phase.name,
      visit: phase.visit,
      expected: phase.metrics.counts.expected,
      transfers: phase.transfers,
    })),
    ...journeyTransferRows(report),
  ];
  const lines = [
    '## Cloudflare build and browser metrics',
    '',
    `[Metric definitions](${options.repositoryUrl}/blob/${build.revision}/docs/reference/operations/build-metrics.md).`,
    '',
    `- Revision: \`${build.revision}\``,
    `- Build time: ${(build.buildMs / 1000).toFixed(1)} s.`,
    `- Worker output: ${(build.workerBytes / 1024 / 1024).toFixed(2)} MiB (uncompressed filesystem size).`,
    `- Static assets: ${(build.staticAssetBytes / 1024 / 1024).toFixed(2)} MiB across ${build.staticAssetFiles} files (uncompressed filesystem sizes).`,
    `- Tracked source lines: ${build.sourceLines.toLocaleString('en-US')}.`,
    '',
    `Measurement status: **${phases.some((phase) => phaseStatus(phase.metrics) === 'incomplete') ? 'failed (incomplete measurements)' : report.status}**. Scope: ${report.scope ?? 'public with separately reported private availability'}.`,
    '',
    ...(report.reason ? [report.reason, ''] : []),
    'Timing medians include valid samples only. Times are milliseconds except CLS; n/a means no valid value was available.',
    '',
    '| Route | Visit | Status | Valid/expected | Attempted | Failed | Unavailable | Missing | TTFB | FCP | LCP | CLS |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...phases.map(timingRow),
    '',
    ...phases
      .filter((phase) => phase.metrics.reason !== undefined)
      .map(
        (phase) =>
          `- \`${phase.name}\` (${phase.visit}): ${phase.metrics.reason}`
      ),
    '',
    ...journeyTable(report),
    '### Transfer bytes',
    '',
    ...transferTable(transfers),
    ...screenshotSummary(report, options.runUrl),
  ];
  return lines.join('\n');
}
async function baselineComparison(
  options: SummaryOptions,
  current: PreviewReport
): Promise<string> {
  if (!options.baselineDirectory) return '';
  try {
    const report: PreviewReport = JSON.parse(
      await readFile(
        resolve(
          options.root,
          options.baselineDirectory,
          'artifacts/cloudflare-preview-metrics.json'
        ),
        'utf8'
      )
    );
    return formatMetricsComparison(report, current);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return '\n## Pull request base comparison\n\nBaseline comparison is unavailable because the baseline did not produce its browser report. No transfer delta was calculated.\n';
    throw new Error('Could not read the baseline measurement report.', {
      cause: error,
    });
  }
}
async function currentReport(root: string): Promise<PreviewReport> {
  try {
    return JSON.parse(
      await readFile(
        join(root, 'artifacts/cloudflare-preview-metrics.json'),
        'utf8'
      )
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return {
        status: 'failed',
        reason:
          'The candidate browser report is missing. No visitor measurements are available.',
        samplesPerRoute: 0,
        routes: {},
      };
    throw new Error('Could not read the candidate measurement report.', {
      cause: error,
    });
  }
}
export async function writeMetricsSummary(options: SummaryOptions) {
  const build: CloudflareBuildMetrics = JSON.parse(
    await readFile(
      join(options.root, 'artifacts/cloudflare-build-metrics.json'),
      'utf8'
    )
  );
  const preview = await currentReport(options.root);
  const summary =
    formatMetricsSummary(build, preview, options) +
    (await baselineComparison(options, preview));
  await appendFile(options.summaryPath, summary);
  return summary;
}
if (isMain(import.meta.url)) {
  const repositoryUrl = `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`;
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) throw new Error('GITHUB_STEP_SUMMARY is required.');
  await writeMetricsSummary({
    root: process.cwd(),
    baselineDirectory: process.env.PREVIEW_METRICS_BASELINE_DIRECTORY,
    summaryPath,
    repositoryUrl,
    runUrl: `${repositoryUrl}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  });
}
