export interface BrowserSample {
  ttfbMs: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number | null;
}

export interface LayoutShiftSample {
  startTime: number;
  value: number;
  hadRecentInput: boolean;
}

export interface DocumentObservation extends BrowserSample {
  supported: { paint: boolean; lcp: boolean; cls: boolean };
  visibility: string;
  hiddenDuringMeasurement: boolean;
}

export interface MeasurementSample extends BrowserSample {
  status: 'valid' | 'failed' | 'unavailable';
  reason?: string;
  observation?: DocumentObservation;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle]!;
  return (ordered[middle - 1]! + ordered[middle]!) / 2;
}

export function medianMetric(
  samples: BrowserSample[],
  metric: keyof BrowserSample
): number | null {
  const values = samples
    .map((sample) => sample[metric])
    .filter(
      (value): value is number => value !== null && Number.isFinite(value)
    );
  const result = median(values);
  return result === null ? null : Math.round(result * 100_000) / 100_000;
}

export function calculateCls(entries: LayoutShiftSample[]): number {
  let sessionValue = 0;
  let sessionStart = 0;
  let previousShift = 0;
  let largestSession = 0;
  for (const entry of entries
    .filter((candidate) => !candidate.hadRecentInput)
    .sort((left, right) => left.startTime - right.startTime)) {
    if (
      sessionValue === 0 ||
      entry.startTime - previousShift >= 1_000 ||
      entry.startTime - sessionStart >= 5_000
    ) {
      sessionValue = entry.value;
      sessionStart = entry.startTime;
    } else sessionValue += entry.value;
    previousShift = entry.startTime;
    largestSession = Math.max(largestSession, sessionValue);
  }
  return largestSession;
}

export function unavailableSample(reason: string): MeasurementSample {
  return {
    status: 'unavailable',
    reason,
    ttfbMs: null,
    fcpMs: null,
    lcpMs: null,
    cls: null,
  };
}

export function failedSample(reason: string): MeasurementSample {
  return { ...unavailableSample(reason), status: 'failed' };
}

export function assessDocument(
  observation: DocumentObservation
): MeasurementSample {
  const metrics = { ...observation, observation };
  if (
    observation.visibility !== 'visible' ||
    observation.hiddenDuringMeasurement
  ) {
    return {
      ...metrics,
      status: 'unavailable',
      reason: 'The document was hidden during measurement.',
    };
  }
  const missing = [
    ['TTFB', observation.ttfbMs, true],
    ['FCP', observation.fcpMs, observation.supported.paint],
    ['LCP', observation.lcpMs, observation.supported.lcp],
  ] as const;
  const absent = missing
    .filter(
      ([, value, supported]) =>
        supported && (value === null || !Number.isFinite(value) || value <= 0)
    )
    .map(([name]) => name);
  if (absent.length > 0)
    return {
      ...metrics,
      status: 'failed',
      reason: `Missing supported measurements: ${absent.join(', ')}.`,
    };
  if (!Object.values(observation.supported).every(Boolean)) {
    return {
      ...metrics,
      status: 'unavailable',
      reason: 'A required performance entry type is unsupported.',
    };
  }
  return { ...metrics, status: 'valid' };
}

export function summarizeSamples(
  samples: MeasurementSample[],
  expected: number
) {
  const valid = samples.filter((sample) => sample.status === 'valid');
  const counts = {
    expected,
    attempted: samples.length,
    valid: valid.length,
    failed: samples.filter((sample) => sample.status === 'failed').length,
    unavailable: samples.filter((sample) => sample.status === 'unavailable')
      .length,
    missing: Math.max(0, expected - samples.length),
  };
  const status =
    counts.failed > 0 || counts.missing > 0
      ? 'failed'
      : counts.unavailable > 0
        ? 'unavailable'
        : 'valid';
  return {
    status,
    counts,
    samples,
    ttfbMs: medianMetric(valid, 'ttfbMs'),
    fcpMs: medianMetric(valid, 'fcpMs'),
    lcpMs: medianMetric(valid, 'lcpMs'),
    cls: medianMetric(valid, 'cls'),
    metricSamples: Object.fromEntries(
      ['ttfbMs', 'fcpMs', 'lcpMs', 'cls'].map((metric) => [
        metric,
        valid.filter((sample) => sample[metric as keyof BrowserSample] !== null)
          .length,
      ])
    ),
  };
}
