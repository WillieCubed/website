import type {
  PreviewReport,
  SampleCounts,
  Transfer,
} from './metrics-summary.mts';
import { median } from './preview-measurement.mts';
import type { TransferCategory } from './preview-transfers.mts';

interface Row {
  name: string;
  visit: string;
  status: string;
  counts: SampleCounts;
  transfers: Transfer[];
}
const FIELDS: ('total' | TransferCategory)[] = [
  'total',
  'html',
  'rsc',
  'js',
  'css',
  'images',
  'json',
  'other',
];
function routeRows(report: PreviewReport): Row[] {
  const result: Row[] = [];
  for (const [name, route] of Object.entries(report.routes)) {
    result.push({
      name,
      visit: 'cold',
      status: route.status,
      counts: route.counts,
      transfers: route.transfers?.cold ?? [],
    });
    if (route.warm)
      result.push({
        name,
        visit: 'warm',
        status: route.warm.status,
        counts: route.warm.counts,
        transfers: route.transfers?.warm ?? [],
      });
  }
  return result;
}
function rows(report: PreviewReport): Row[] {
  const result = routeRows(report);
  const journeys = new Map<string, Row>();
  for (const [name, runs] of Object.entries(report.journeys ?? {})) {
    const counts = report.journeyCounts?.[name];
    if (!counts) continue;
    for (const run of runs)
      for (const step of run.steps) {
        const key = `${name}: ${step.path}`;
        const row = journeys.get(key) ?? {
          name: key,
          visit: 'journey',
          status: counts.status,
          counts,
          transfers: [],
        };
        row.transfers.push(step.transfer);
        journeys.set(key, row);
      }
  }
  return [...result, ...journeys.values()];
}
function validWindow(transfer: Transfer): boolean {
  const brokenResource =
    transfer.failed?.some((failure) =>
      ['html', 'js', 'css', 'images'].includes(failure.category ?? 'other')
    ) === true;
  return (
    !brokenResource &&
    (transfer.unanswered ?? 0) === 0 &&
    transfer.settlement?.status !== 'timeout' &&
    Number.isFinite(transfer.bytes)
  );
}
function complete(row: Row | undefined): boolean {
  if (!row || row.status !== 'valid') return false;
  if (row.counts.failed + row.counts.unavailable + row.counts.missing > 0)
    return false;
  return (
    row.counts.valid === row.counts.expected &&
    row.transfers.length === row.counts.expected &&
    row.transfers.every(validWindow)
  );
}
function amount(
  row: Row | undefined,
  field: 'total' | TransferCategory,
  prefetch: boolean
): number | null {
  if (!row) return null;
  return median(
    row.transfers.map((sample) => {
      const transfer = prefetch ? sample.prefetch : sample;
      return field === 'total' ? transfer.bytes : transfer.byCategory[field];
    })
  );
}
function value(value: number | null): string {
  return value === null ? 'n/a' : String(value);
}
function delta(
  before: Row | undefined,
  after: Row | undefined,
  field: 'total' | TransferCategory,
  prefetch: boolean
): string {
  if (!complete(before) || !complete(after)) return 'n/a';
  const previous = amount(before, field, prefetch);
  const current = amount(after, field, prefetch);
  if (previous === null || current === null) return 'n/a';
  const difference = current - previous;
  return `${difference > 0 ? '+' : ''}${difference}`;
}
function status(row: Row | undefined): string {
  if (!row) return 'missing';
  const counts = row.counts;
  return `${row.status}; ${counts.valid}/${counts.expected} valid; ${counts.failed} failed; ${counts.unavailable} unavailable; ${counts.missing} missing`;
}
function table(
  before: Map<string, Row>,
  after: Map<string, Row>,
  prefetch: boolean
): string[] {
  const output = [
    '| Route or journey step | Visit | Revision | Total | HTML | RSC | JS | CSS | Images | JSON | Other |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const baseline = before.get(key),
      current = after.get(key);
    const row = baseline ?? current!;
    for (const revision of ['baseline', 'current', 'delta']) {
      const cells = FIELDS.map((field) =>
        revision === 'delta'
          ? delta(baseline, current, field, prefetch)
          : value(
              amount(
                revision === 'baseline' ? baseline : current,
                field,
                prefetch
              )
            )
      );
      output.push(
        `| \`${row.name}\` | ${row.visit} | ${revision} | ${cells.join(' | ')} |`
      );
    }
  }
  return output;
}
export function formatMetricsComparison(
  baseline: PreviewReport,
  current: PreviewReport
): string {
  const before = new Map(
    rows(baseline).map((row) => [`${row.name}:${row.visit}`, row])
  );
  const after = new Map(
    rows(current).map((row) => [`${row.name}:${row.visit}`, row])
  );
  const outcomes = [...new Set([...before.keys(), ...after.keys()])].map(
    (key) => {
      const row = before.get(key) ?? after.get(key)!;
      return `| \`${row.name}\` | ${row.visit} | ${status(before.get(key))} | ${status(after.get(key))} |`;
    }
  );
  return [
    '\n## Pull request base comparison',
    '',
    `Baseline: \`${baseline.revision ?? 'unknown'}\` (${baseline.status}). Current: \`${current.revision ?? 'unknown'}\` (${current.status}).`,
    '',
    'Both targets use the current collector on the same runner. Delta means current minus baseline, in exact encoded bytes. A delta is n/a when either sample group is missing, failed, incomplete, unanswered, or contains a failed core resource. Timings remain informational and have no enforced budget.',
    '',
    '| Route or journey step | Visit | Baseline outcome | Current outcome |',
    '| --- | --- | --- | --- |',
    ...outcomes,
    '',
    '### Visitor transfer comparison',
    '',
    'Total includes prefetch. The category columns exclude prefetch.',
    '',
    ...table(before, after, false),
    '',
    '### Prefetch comparison',
    '',
    ...table(before, after, true),
    '',
    'Baseline JSON and captures are in the `cloudflare-baseline-build-metrics` and `cloudflare-baseline-preview-screenshots` artifacts.',
    '',
  ].join('\n');
}
