import {
  type Browser,
  type BrowserContextOptions,
  chromium,
} from '@playwright/test';
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { isMain } from '../shared/command.mts';
import {
  openNextPreviewArgs,
  writeLocalWranglerConfig,
} from './local-wrangler-config.mts';
import { summarizeSamples } from './preview-measurement.mts';
import {
  assertPreviewPortAvailable,
  monitorPreview,
  previewRuntimeError,
  stopPreview,
  waitUntilReady,
} from './preview-process.mts';
import { writePreviewReport } from './preview-report.mts';
import { capturePreviewScreenshots } from './preview-screenshots.mts';
import {
  BASE_URL,
  type SampleOptions,
  sampleJourney,
  sampleRoute,
} from './preview-visits.mts';

export { sampleRoute, sampleJourney } from './preview-visits.mts';

export {
  median,
  medianMetric,
  calculateCls,
  type BrowserSample,
  type LayoutShiftSample,
} from './preview-measurement.mts';
export const ROUTES = [
  '/',
  '/search',
  '/writings',
  '/initiatives',
  '/projects',
  '/music',
];
const SAMPLE_COUNT = 5;
const PUBLIC_REPORT_STATUS = {
  available: 'valid',
  unavailable: 'partial',
  failed: 'failed',
} as const;
interface Journey {
  name: string;
  paths: string[];
}
const JOURNEYS: Journey[] = [
  { name: 'discover-writing', paths: ['/search', '/writings'] },
  { name: 'browse-projects', paths: ['/writings', '/projects'] },
  { name: 'discover-music', paths: ['/projects', '/music'] },
];
function unavailablePrivateRoutes(
  reason: string,
  paths = ['/studio', '/studio/music'],
  count = SAMPLE_COUNT
) {
  return Object.fromEntries(
    paths.map((path) => [
      path,
      {
        ...summarizeSamples([], count),
        status: 'unavailable',
        reason,
      },
    ])
  );
}

async function collectPrivate(browser: Browser, options: SampleOptions = {}) {
  const baseUrl = process.env.PREVIEW_METRICS_PRIVATE_BASE_URL;
  const paths = ['/studio', '/studio/music'];
  if (!baseUrl)
    return unavailablePrivateRoutes(
      'PREVIEW_METRICS_PRIVATE_BASE_URL is not configured; no authenticated private target was measured.',
      paths,
      options.sampleCount
    );
  const configuredInitiative = process.env.PREVIEW_METRICS_INITIATIVE_PATH;
  if (configuredInitiative) {
    const path = initiativeDetailPath(configuredInitiative, baseUrl);
    if (!path)
      throw new Error(
        'PREVIEW_METRICS_INITIATIVE_PATH must identify a same-origin initiative detail route.'
      );
    paths.push(path);
  }
  const contextOptions: BrowserContextOptions = {
    storageState: process.env.PREVIEW_METRICS_PRIVATE_STORAGE_STATE,
  };
  const headers: Record<string, string> = JSON.parse(
    process.env.PREVIEW_METRICS_PRIVATE_HEADERS ?? '{}'
  );
  const context = await browser.newContext(contextOptions);
  try {
    const probe = await context.request.get(
      new URL('/api/studio/documents', baseUrl).href,
      { maxRedirects: 0, headers }
    );
    if (!probe.ok())
      return unavailablePrivateRoutes(
        `Private authentication/data probe returned HTTP ${probe.status()}.`,
        paths,
        options.sampleCount
      );
  } catch {
    return unavailablePrivateRoutes(
      'Private authentication/data probe could not reach the authenticated target.',
      paths,
      options.sampleCount
    );
  } finally {
    await context.close();
  }
  const routes: Record<string, Awaited<ReturnType<typeof sampleRoute>>> = {};
  for (const path of paths)
    routes[path] = await sampleRoute(browser, path, {
      ...options,
      baseUrl,
      contextOptions: { ...contextOptions, extraHTTPHeaders: headers },
    });
  return routes;
}

interface InitiativeTarget {
  status: 'available' | 'unavailable' | 'failed';
  path: string | null;
  reason?: string;
}
function initiativeDetailPath(href: string, baseUrl: string): string | null {
  const url = new URL(href, baseUrl);
  if (
    url.origin !== new URL(baseUrl).origin ||
    !/^\/initiatives\/[^/]+\/?$/.test(url.pathname)
  )
    return null;
  return url.pathname.replace(/\/$/, '');
}
export async function resolveInitiativeTarget(
  browser: Browser,
  baseUrl: string,
  configuredPath = process.env.PREVIEW_METRICS_INITIATIVE_PATH
): Promise<InitiativeTarget> {
  if (configuredPath) {
    const path = initiativeDetailPath(configuredPath, baseUrl);
    return path
      ? { status: 'available', path }
      : {
          status: 'failed',
          path: null,
          reason:
            'PREVIEW_METRICS_INITIATIVE_PATH must identify a same-origin initiative detail route.',
        };
  }
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const response = await page.goto(new URL('/initiatives', baseUrl).href, {
      waitUntil: 'load',
    });
    if (!response?.ok())
      throw new Error(
        `Initiative discovery returned HTTP ${response?.status() ?? 'no response'}.`
      );
    const hrefs = await page
      .locator('main a[href]')
      .filter({ visible: true })
      .evaluateAll((links) => links.map((link) => link.getAttribute('href')!));
    const path = hrefs
      .map((href) => initiativeDetailPath(href, baseUrl))
      .find((candidate) => candidate !== null);
    return path
      ? { status: 'available', path }
      : {
          status: 'unavailable',
          path: null,
          reason: 'No published initiative detail link exists on /initiatives.',
        };
  } catch (error) {
    return { status: 'failed', path: null, reason: String(error) };
  } finally {
    await context.close();
  }
}
function unmeasuredRoute(target: InitiativeTarget, count: number) {
  const summary = {
    ...summarizeSamples([], count),
    status: target.status,
    reason: target.reason,
  };
  return { ...summary, warm: summary, transfers: { cold: [], warm: [] } };
}
type JourneyRun = Awaited<ReturnType<typeof sampleJourney>>;
function journeyCount(runs: JourneyRun[], count: number) {
  const failed = runs.filter((run) => run.status === 'failed').length;
  const unavailable = runs.filter((run) => run.status === 'unavailable').length;
  const missing = Math.max(0, count - runs.length);
  return {
    expected: count,
    attempted: runs.length,
    valid: runs.filter((run) => run.status === 'valid').length,
    failed,
    unavailable,
    missing,
    status:
      failed > 0 || missing > 0
        ? 'failed'
        : unavailable > 0
          ? 'unavailable'
          : 'valid',
  };
}
async function collectJourneys(
  browser: Browser,
  baseUrl: string,
  options: SampleOptions,
  initiative: InitiativeTarget
) {
  const plans = [...JOURNEYS];
  if (initiative.path)
    plans.push({
      name: 'explore-initiatives',
      paths: ['/initiatives', initiative.path],
    });
  const count = options.sampleCount ?? SAMPLE_COUNT;
  const journeys: Record<string, JourneyRun[]> = {};
  for (const journey of plans) {
    journeys[journey.name] = [];
    for (let index = 0; index < count; index++) {
      const run = await sampleJourney(browser, journey, {
        ...options,
        baseUrl,
      });
      journeys[journey.name]!.push(run);
      console.log(
        `Cloudflare preview journey ${journey.name} run ${index + 1}/${count}: ${run.status}; ${run.steps.length}/${journey.paths.length} steps.`
      );
    }
  }
  const journeyCounts = Object.fromEntries(
    Object.entries(journeys).map(([name, runs]) => [
      name,
      journeyCount(runs, count),
    ])
  );
  if (!initiative.path) {
    journeys['explore-initiatives'] = [];
    journeyCounts['explore-initiatives'] = {
      ...journeyCount([], count),
      status: initiative.status,
    };
  }
  return { journeys, journeyCounts };
}
function publicMeasurementFailed(
  routes: Record<string, Awaited<ReturnType<typeof sampleRoute>>>,
  journeys: Record<string, JourneyRun[]>
) {
  return (
    Object.values(routes).some(
      (route) => route.status !== 'valid' || route.warm.status !== 'valid'
    ) ||
    Object.values(journeys)
      .flat()
      .some((journey) => journey.status !== 'valid')
  );
}
export async function collectPreviewMetrics(
  browser: Browser,
  baseUrl = BASE_URL,
  options: SampleOptions = {}
) {
  const count = options.sampleCount ?? SAMPLE_COUNT;
  if (process.env.PREVIEW_METRICS_PRIVATE_ONLY === '1')
    return collectPrivateMetrics(browser, options);
  const initiativeTarget = await resolveInitiativeTarget(browser, baseUrl);
  const routes: Record<string, Awaited<ReturnType<typeof sampleRoute>>> = {};
  const paths = [...ROUTES];
  if (initiativeTarget.path) paths.push(initiativeTarget.path);
  for (const [index, route] of paths.entries()) {
    routes[route] = await sampleRoute(browser, route, { ...options, baseUrl });
    const result = routes[route];
    console.log(
      `Cloudflare preview route ${index + 1}/${paths.length}: cold ${result.status} ${result.counts.valid}/${count}; warm ${result.warm.status} ${result.warm.counts.valid}/${count}.`
    );
  }
  const { journeys, journeyCounts } = await collectJourneys(
    browser,
    baseUrl,
    options,
    initiativeTarget
  );
  const failed =
    publicMeasurementFailed(routes, journeys) ||
    initiativeTarget.status === 'failed';
  if (!initiativeTarget.path)
    routes['initiative-detail'] = unmeasuredRoute(initiativeTarget, count);
  const privateRoutes = await collectPrivate(browser, options);
  return {
    revision: execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim(),
    samplesPerRoute: count,
    status: failed ? 'failed' : PUBLIC_REPORT_STATUS[initiativeTarget.status],
    routes,
    journeys,
    journeyCounts,
    initiativeTarget,
    privateRoutes,
  };
}
async function collectPrivateMetrics(browser: Browser, options: SampleOptions) {
  const count = options.sampleCount ?? SAMPLE_COUNT;
  const routes: Record<string, Awaited<ReturnType<typeof sampleRoute>>> = {};
  const journeys: Record<string, JourneyRun[]> = {};
  const journeyCounts: Record<string, ReturnType<typeof journeyCount>> = {};
  const privateRoutes = await collectPrivate(browser, options);
  const valid = Object.values(privateRoutes).every(
    (route) =>
      route.status === 'valid' &&
      'warm' in route &&
      route.warm.status === 'valid'
  );
  return {
    revision: execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim(),
    samplesPerRoute: count,
    scope: 'private',
    status: valid ? 'valid' : 'failed',
    routes,
    journeys,
    journeyCounts,
    initiativeTarget: {
      status: 'unavailable',
      path: null,
      reason: 'Public routes were not measured in private-only mode.',
    },
    privateRoutes,
  };
}

function startLocalPreview(root: string, configPath: string): ChildProcess {
  return spawn(
    'pnpm',
    openNextPreviewArgs(configPath, ['--ip', '127.0.0.1', '--port', '8787']),
    {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    }
  );
}

function previewError(error: unknown, output: string) {
  const details = output.trim().slice(-12_000);
  return new Error(
    `${error instanceof Error ? error.message : String(error)}${details ? `\n\nPreview output:\n${details}` : ''}`,
    { cause: error }
  );
}
async function cleanUpMetrics(
  browser: Browser | undefined,
  preview: ChildProcess | undefined,
  config: Awaited<ReturnType<typeof writeLocalWranglerConfig>> | undefined
) {
  try {
    await browser?.close();
  } finally {
    try {
      if (preview) await stopPreview(preview);
    } finally {
      await config?.remove();
    }
  }
}

export async function captureOptionalScreenshots(
  browser: Browser,
  metrics: Awaited<ReturnType<typeof collectPreviewMetrics>>,
  root: string,
  baseUrl: string
) {
  if (process.env.PREVIEW_METRICS_SCREENSHOTS !== '1') return metrics;
  const privateOnly = process.env.PREVIEW_METRICS_PRIVATE_ONLY === '1';
  const target = privateOnly
    ? process.env.PREVIEW_METRICS_PRIVATE_BASE_URL
    : baseUrl;
  if (!target) return metrics;
  const screenshots = await capturePreviewScreenshots(browser, {
    baseUrl: target,
    routes: Object.keys(
      privateOnly ? metrics.privateRoutes : metrics.routes
    ).filter((path) => path.startsWith('/')),
    outputDirectory: join(root, 'artifacts/cloudflare-preview-screenshots'),
    contextOptions: privateOnly
      ? {
          storageState: process.env.PREVIEW_METRICS_PRIVATE_STORAGE_STATE,
          extraHTTPHeaders: JSON.parse(
            process.env.PREVIEW_METRICS_PRIVATE_HEADERS ?? '{}'
          ),
        }
      : undefined,
  });
  return {
    ...metrics,
    screenshots: {
      status: screenshots.status,
      captured: screenshots.captured,
      expected: screenshots.expected,
      manifest: 'artifacts/cloudflare-preview-screenshots/manifest.json',
    },
  };
}
async function persistPreviewMetrics(
  browser: Browser,
  root: string,
  baseUrl: string,
  signal?: AbortSignal
) {
  signal?.throwIfAborted();
  const metrics = await collectPreviewMetrics(browser, baseUrl);
  signal?.throwIfAborted();
  const outputPath = join(root, 'artifacts/cloudflare-preview-metrics.json');
  await mkdir(join(root, 'artifacts'), { recursive: true });
  await writePreviewReport(outputPath, metrics, signal);
  const report = await captureOptionalScreenshots(
    browser,
    metrics,
    root,
    baseUrl
  );
  await writePreviewReport(outputPath, report, signal);
  console.log(`Cloudflare preview metrics: ${relative(root, outputPath)}`);
  if (report.status === 'failed')
    throw new Error(
      'Browser measurement failed; inspect sample outcomes in artifacts/cloudflare-preview-metrics.json.'
    );
  if ('screenshots' in report && report.screenshots.status === 'failed')
    throw new Error(
      'Screenshot evidence failed; inspect artifacts/cloudflare-preview-screenshots/manifest.json.'
    );
  return report;
}

export async function recordPreviewFailure(
  root: string,
  startedAt: number,
  error: unknown
) {
  const outputPath = join(root, 'artifacts/cloudflare-preview-metrics.json');
  let report: Record<string, unknown> = {
    samplesPerRoute: SAMPLE_COUNT,
    routes: {},
    privateRoutes: {},
    journeys: {},
    journeyCounts: {},
  };
  try {
    const [saved, info] = await Promise.all([
      readFile(outputPath, 'utf8'),
      stat(outputPath),
    ]);
    if (info.mtimeMs >= startedAt)
      report = JSON.parse(saved) as Record<string, unknown>;
  } catch {
    // Startup can fail before any browser measurements exist.
  }
  await mkdir(join(root, 'artifacts'), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify({ ...report, status: 'failed', reason: String(error) }, null, 2)}\n`
  );
}

export async function runCloudflarePreviewMetrics() {
  const root = process.cwd();
  const startedAt = Date.now();
  let failure: unknown;
  const externalTarget = process.env.PREVIEW_METRICS_BASE_URL;
  const config = externalTarget
    ? undefined
    : await writeLocalWranglerConfig(root);
  let preview: ChildProcess | undefined;
  let capturedOutput = '';
  let spawnError: Error | undefined;
  let browser: Browser | undefined;
  try {
    if (config) {
      await assertPreviewPortAvailable();
      preview = startLocalPreview(root, config.path);
      preview.on('error', (error) => {
        spawnError = error;
      });
      const capture = (chunk: Buffer) => {
        capturedOutput += chunk.toString();
        spawnError ??= previewRuntimeError(capturedOutput);
      };
      preview.stdout?.on('data', capture);
      preview.stderr?.on('data', capture);
      await waitUntilReady(
        preview,
        () => spawnError,
        () => /Ready on http/.test(capturedOutput)
      );
    }
    browser = await chromium.launch({ headless: true });
    const measure = (signal?: AbortSignal) =>
      persistPreviewMetrics(browser!, root, externalTarget ?? BASE_URL, signal);
    return preview
      ? await monitorPreview(preview, () => spawnError, measure)
      : await measure();
  } catch (error) {
    failure = error;
    throw previewError(error, capturedOutput);
  } finally {
    try {
      await cleanUpMetrics(browser, preview, config);
    } finally {
      if (config && failure !== undefined)
        await recordPreviewFailure(root, startedAt, failure);
      if (preview) {
        await mkdir(join(root, 'artifacts'), { recursive: true });
        await writeFile(
          join(root, 'artifacts/cloudflare-preview-runtime.log'),
          capturedOutput
        );
      }
    }
  }
}
if (isMain(import.meta.url)) await runCloudflarePreviewMetrics();
