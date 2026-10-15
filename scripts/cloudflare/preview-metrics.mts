import { type Browser, chromium } from '@playwright/test';
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { performance } from 'node:perf_hooks';

import { isMain } from '../shared/command.mts';

const BASE_URL = 'http://127.0.0.1:8787';
const ROUTES = ['/', '/search', '/writings'];
const SAMPLE_COUNT = 5;
const READY_TIMEOUT_MS = 180_000;

export interface BrowserSample {
  ttfbMs: number;
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number;
}

export interface LayoutShiftSample {
  startTime: number;
  value: number;
  hadRecentInput: boolean;
}

interface PreviewMetrics {
  revision: string;
  samplesPerRoute: number;
  routes: Record<string, BrowserSample & { samples: BrowserSample[] }>;
}

interface MetricsPage {
  addInitScript(script: () => void): Promise<unknown>;
  goto(
    url: string,
    options: { waitUntil: 'load' }
  ): Promise<{ status(): number } | null>;
  evaluate<Result>(callback: () => Result): Promise<Result>;
  close(): Promise<void>;
}

interface MetricsBrowser {
  newPage(): Promise<MetricsPage>;
}

declare global {
  interface Window {
    __cloudflarePerformanceMetrics?: {
      lcp: number | null;
      lastEntryAt: number;
      layoutShifts: LayoutShiftSample[];
    };
  }
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle]!;
  return (ordered[middle - 1]! + ordered[middle]!) / 2;
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
    } else {
      sessionValue += entry.value;
    }
    previousShift = entry.startTime;
    largestSession = Math.max(largestSession, sessionValue);
  }
  return largestSession;
}

export function medianMetric(
  samples: BrowserSample[],
  metric: keyof BrowserSample
): number | null {
  const values = samples
    .map((sample) => sample[metric])
    .filter((value): value is number => value !== null);
  const result = median(values);
  return result === null ? null : Math.round(result * 100_000) / 100_000;
}

export async function waitUntilReady(
  preview: ReturnType<typeof spawn>,
  getSpawnError: () => Error | undefined
) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError: unknown;
  while (Date.now() < deadline) {
    const spawnError = getSpawnError();
    if (spawnError) {
      throw new Error(
        `Cloudflare preview could not start: ${spawnError.message}`
      );
    }
    if (preview.exitCode !== null) {
      throw new Error(
        `Cloudflare preview exited early with status ${preview.exitCode}.`
      );
    }
    let response: Response | undefined;
    try {
      response = await fetch(BASE_URL, {
        signal: AbortSignal.timeout(2_000),
      });
    } catch (error) {
      lastError = error;
    }
    if (response?.ok) return;
    if (response && response.status >= 400) {
      throw new Error(
        `Cloudflare preview readiness route returned HTTP ${response.status}.`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(
    `Cloudflare preview did not become ready at ${BASE_URL} within ${READY_TIMEOUT_MS}ms.${lastError ? ` Last error: ${String(lastError)}` : ''}`
  );
}

export async function stopPreview(preview: ChildProcess): Promise<void> {
  if (preview.exitCode !== null || preview.signalCode !== null || !preview.pid)
    return;
  const kill = (signal: NodeJS.Signals) => {
    if (preview.pid && process.platform !== 'win32') {
      try {
        process.kill(-preview.pid, signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
    } else if (preview.pid) preview.kill(signal);
  };
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      kill('SIGKILL');
      resolve();
    }, 5_000);
    preview.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    kill('SIGTERM');
  });
}

export async function sampleRoute(browser: MetricsBrowser, path: string) {
  const samples: BrowserSample[] = [];
  for (let sampleIndex = 0; sampleIndex < SAMPLE_COUNT; sampleIndex += 1) {
    const page = await browser.newPage();
    try {
      await page.addInitScript(() => {
        const state: NonNullable<Window['__cloudflarePerformanceMetrics']> = {
          lcp: null,
          lastEntryAt: performance.now(),
          layoutShifts: [],
        };
        window.__cloudflarePerformanceMetrics = state;
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              state.lcp = entry.startTime;
              state.lastEntryAt = performance.now();
            }
          }).observe({ type: 'largest-contentful-paint', buffered: true });
        } catch {
          // Browsers without the entry type report LCP as unavailable.
        }
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const shift = entry as PerformanceEntry & {
                hadRecentInput?: boolean;
                value?: number;
              };
              state.layoutShifts.push({
                startTime: entry.startTime,
                value: shift.value ?? 0,
                hadRecentInput: Boolean(shift.hadRecentInput),
              });
              state.lastEntryAt = performance.now();
            }
          }).observe({ type: 'layout-shift', buffered: true });
        } catch {
          // CLS remains zero when the browser does not expose layout-shift entries.
        }
      });

      const response = await page.goto(`${BASE_URL}${path}`, {
        waitUntil: 'load',
      });
      if (!response || response.status() < 200 || response.status() >= 300) {
        throw new Error(
          `Cloudflare preview route ${path} returned ${response?.status() ?? 'no response'} on sample ${sampleIndex + 1}.`
        );
      }
      await page.evaluate(async () => {
        const state = window.__cloudflarePerformanceMetrics;
        if (!state) return;
        const quietMs = 1_000;
        const deadline = performance.now() + 10_000;
        while (performance.now() < deadline) {
          await new Promise<void>((resolve) => setTimeout(resolve, 100));
          if (performance.now() - state.lastEntryAt >= quietMs) return;
        }
      });
      const sample = await page.evaluate(() => {
        const entries = performance.getEntries();
        const navigation = entries.find(
          (entry) => String(entry.entryType) === 'navigation'
        ) as PerformanceNavigationTiming | undefined;
        const fcp = entries.find(
          (entry) =>
            String(entry.entryType) === 'paint' &&
            entry.name === 'first-contentful-paint'
        );
        return {
          ttfbMs: navigation
            ? navigation.responseStart - navigation.requestStart
            : 0,
          fcpMs: fcp?.startTime ?? null,
          lcpMs: window.__cloudflarePerformanceMetrics?.lcp ?? null,
          layoutShifts:
            window.__cloudflarePerformanceMetrics?.layoutShifts ?? [],
        };
      });
      if (sample.ttfbMs <= 0) {
        throw new Error(
          `Cloudflare preview route ${path} had no navigation timing entry.`
        );
      }
      samples.push({ ...sample, cls: calculateCls(sample.layoutShifts) });
    } finally {
      await page.close();
    }
  }

  return {
    samples,
    ttfbMs: medianMetric(samples, 'ttfbMs')!,
    fcpMs: medianMetric(samples, 'fcpMs'),
    lcpMs: medianMetric(samples, 'lcpMs'),
    cls: medianMetric(samples, 'cls')!,
  };
}

function startLocalPreview(root: string, configPath: string): ChildProcess {
  return spawn(
    'pnpm',
    [
      'exec',
      'opennextjs-cloudflare',
      'preview',
      '--config',
      configPath,
      '--ip',
      '127.0.0.1',
      '--port',
      '8787',
    ],
    {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:
          process.env
            .CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ??
          'postgresql://preview:preview@127.0.0.1:5432/preview',
      },
    }
  );
}

export async function runCloudflarePreviewMetrics() {
  const root = process.cwd();
  const configPath = join(root, `.wrangler.metrics-${process.pid}.jsonc`);
  let preview: ReturnType<typeof spawn> | undefined;
  let configCreated = false;
  let capturedOutput = '';
  let spawnError: Error | undefined;
  let browser: Browser | undefined;
  try {
    const sourceConfig = await readFile(join(root, 'wrangler.jsonc'), 'utf8');
    const config = JSON.parse(
      sourceConfig.replace(/,\s*([}\]])/g, '$1')
    ) as Record<string, unknown>;
    // Local preview should use its loopback hostname instead of Wrangler's
    // configured custom domains, which intentionally redirect to production.
    delete config.routes;
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {
      flag: 'wx',
    });
    configCreated = true;

    preview = startLocalPreview(root, configPath);
    preview.on('error', (error) => {
      spawnError = error;
    });
    const capture = (chunk: Buffer) => {
      capturedOutput = `${capturedOutput}${chunk.toString()}`.slice(-12_000);
    };
    preview.stdout?.on('data', capture);
    preview.stderr?.on('data', capture);
    await waitUntilReady(preview, () => spawnError);
    browser = await chromium.launch({ headless: true });
    const routes: PreviewMetrics['routes'] = {};
    for (const route of ROUTES)
      routes[route] = await sampleRoute(browser, route);

    const metrics: PreviewMetrics = {
      revision: execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).trim(),
      samplesPerRoute: SAMPLE_COUNT,
      routes,
    };
    const outputPath = join(root, 'artifacts/cloudflare-preview-metrics.json');
    await mkdir(join(root, 'artifacts'), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(metrics, null, 2)}\n`);
    console.log(`Cloudflare preview metrics: ${relative(root, outputPath)}`);
    return metrics;
  } catch (error) {
    const details = capturedOutput.trim();
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}${details ? `\n\nPreview output:\n${details}` : ''}`,
      { cause: error }
    );
  } finally {
    try {
      await browser?.close();
    } finally {
      try {
        if (preview) await stopPreview(preview);
      } finally {
        if (configCreated) await unlink(configPath).catch(() => undefined);
      }
    }
  }
}

if (isMain(import.meta.url)) await runCloudflarePreviewMetrics();
