import {
  type Browser,
  type BrowserContextOptions,
  chromium,
} from '@playwright/test';
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { isMain } from '../shared/command.mts';
import {
  openNextPreviewArgs,
  writeLocalWranglerConfig,
} from './local-wrangler-config.mts';
import { summarizeSamples } from './preview-measurement.mts';
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
const READY_TIMEOUT_MS = 180_000;
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
  if (
    preview.exitCode !== null ||
    preview.signalCode !== null ||
    preview.pid === undefined
  )
    return;
  const kill = (signal: NodeJS.Signals) => {
    if (preview.pid !== undefined && process.platform !== 'win32') {
      try {
        process.kill(-preview.pid, signal);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
      }
    } else if (preview.pid !== undefined) preview.kill(signal);
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

function unavailablePrivateRoutes(reason: string) {
  return Object.fromEntries(
    ['/studio', '/studio/music'].map((path) => [
      path,
      {
        ...summarizeSamples([], SAMPLE_COUNT),
        status: 'unavailable',
        reason,
      },
    ])
  );
}

async function collectPrivate(browser: Browser) {
  const baseUrl = process.env.PREVIEW_METRICS_PRIVATE_BASE_URL;
  const paths = ['/studio', '/studio/music'];
  if (!baseUrl)
    return unavailablePrivateRoutes(
      'PREVIEW_METRICS_PRIVATE_BASE_URL is not configured; no authenticated private target was measured.'
    );
  const contextOptions: BrowserContextOptions = {
    storageState: process.env.PREVIEW_METRICS_PRIVATE_STORAGE_STATE,
    extraHTTPHeaders: JSON.parse(
      process.env.PREVIEW_METRICS_PRIVATE_HEADERS ?? '{}'
    ),
  };
  const context = await browser.newContext(contextOptions);
  try {
    const probe = await context.request.get(
      new URL('/api/studio/documents', baseUrl).href,
      { maxRedirects: 0 }
    );
    if (!probe.ok())
      throw new Error(
        `Private authentication/data probe returned HTTP ${probe.status()}.`
      );
  } catch (error) {
    return unavailablePrivateRoutes(String(error));
  } finally {
    await context.close();
  }
  const routes: Record<string, Awaited<ReturnType<typeof sampleRoute>>> = {};
  for (const path of paths)
    routes[path] = await sampleRoute(browser, path, {
      baseUrl,
      contextOptions,
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
    for (let index = 0; index < count; index++)
      journeys[journey.name]!.push(
        await sampleJourney(browser, journey, { ...options, baseUrl })
      );
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
    return collectPrivateMetrics(browser, count);
  const initiativeTarget = await resolveInitiativeTarget(browser, baseUrl);
  const routes: Record<string, Awaited<ReturnType<typeof sampleRoute>>> = {};
  for (const route of ROUTES)
    routes[route] = await sampleRoute(browser, route, { ...options, baseUrl });
  if (initiativeTarget.path)
    routes[initiativeTarget.path] = await sampleRoute(
      browser,
      initiativeTarget.path,
      { ...options, baseUrl }
    );
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
  const privateRoutes = await collectPrivate(browser);
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
async function collectPrivateMetrics(browser: Browser, count: number) {
  const routes: Record<string, Awaited<ReturnType<typeof sampleRoute>>> = {};
  const journeys: Record<string, JourneyRun[]> = {};
  const journeyCounts: Record<string, ReturnType<typeof journeyCount>> = {};
  const privateRoutes = await collectPrivate(browser);
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
  const details = output.trim();
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

async function captureOptionalScreenshots(
  browser: Browser,
  metrics: Awaited<ReturnType<typeof collectPreviewMetrics>>,
  root: string,
  baseUrl: string
) {
  if (
    process.env.PREVIEW_METRICS_SCREENSHOTS !== '1' ||
    process.env.PREVIEW_METRICS_PRIVATE_ONLY === '1'
  )
    return metrics;
  const screenshots = await capturePreviewScreenshots(browser, {
    baseUrl,
    routes: Object.keys(metrics.routes).filter((path) => path.startsWith('/')),
    outputDirectory: join(root, 'artifacts/cloudflare-preview-screenshots'),
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
  baseUrl: string
) {
  const metrics = await collectPreviewMetrics(browser, baseUrl);
  const outputPath = join(root, 'artifacts/cloudflare-preview-metrics.json');
  await mkdir(join(root, 'artifacts'), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(metrics, null, 2)}\n`);
  const report = await captureOptionalScreenshots(
    browser,
    metrics,
    root,
    baseUrl
  );
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
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

export async function runCloudflarePreviewMetrics() {
  const root = process.cwd();
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
      preview = startLocalPreview(root, config.path);
      preview.on('error', (error) => {
        spawnError = error;
      });
      const capture = (chunk: Buffer) => {
        capturedOutput = `${capturedOutput}${chunk.toString()}`.slice(-12_000);
      };
      preview.stdout?.on('data', capture);
      preview.stderr?.on('data', capture);
      await waitUntilReady(preview, () => spawnError);
    }
    browser = await chromium.launch({ headless: true });
    return await persistPreviewMetrics(
      browser,
      root,
      externalTarget ?? BASE_URL
    );
  } catch (error) {
    throw previewError(error, capturedOutput);
  } finally {
    await cleanUpMetrics(browser, preview, config);
  }
}
if (isMain(import.meta.url)) await runCloudflarePreviewMetrics();
