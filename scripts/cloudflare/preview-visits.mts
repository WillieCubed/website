import type { Browser, BrowserContextOptions, Page } from '@playwright/test';

import { authorizePreviewPage } from './preview-auth.mts';
import { requireRouteContent } from './preview-content.mts';
import { observeBrowserErrors } from './preview-errors.mts';
import {
  type MeasurementSample,
  assessDocument,
  failedSample,
  summarizeSamples,
} from './preview-measurement.mts';
import { installObservers, readDocument } from './preview-observers.mts';
import { type TransferLedger, observeTransfers } from './preview-transfers.mts';

// OpenNext applies its local streaming compression workaround only to localhost.
export const BASE_URL = 'http://localhost:8787';
const SAMPLE_COUNT = 5;
export interface SampleOptions {
  baseUrl?: string;
  sampleCount?: number;
  quietMs?: number;
  timeoutMs?: number;
  contextOptions?: BrowserContextOptions;
}
interface ResolvedOptions {
  baseUrl: string;
  sampleCount: number;
  quietMs: number;
  timeoutMs: number;
  contextOptions: Omit<BrowserContextOptions, 'extraHTTPHeaders'>;
  extraHTTPHeaders?: Record<string, string>;
}
interface Journey {
  name: string;
  paths: string[];
}
function resolvedOptions(options: SampleOptions): ResolvedOptions {
  const { extraHTTPHeaders, ...contextOptions } = options.contextOptions ?? {};
  return {
    baseUrl: options.baseUrl ?? BASE_URL,
    sampleCount: options.sampleCount ?? SAMPLE_COUNT,
    quietMs: options.quietMs ?? 1_000,
    timeoutMs: options.timeoutMs ?? 30_000,
    contextOptions,
    extraHTTPHeaders,
  };
}
async function measureVisit(
  page: Page,
  path: string,
  options: ResolvedOptions,
  readErrors: ReturnType<typeof observeBrowserErrors>
) {
  try {
    const response = await page.goto(new URL(path, options.baseUrl).href, {
      waitUntil: 'load',
      timeout: options.timeoutMs,
    });
    if (!response?.ok())
      throw new Error(
        `Route ${path} returned ${response?.status() ?? 'no response'}.`
      );
    const actual = new URL(page.url()).pathname;
    if (actual !== path)
      throw new Error(`Route ${path} redirected to ${actual}.`);
    const measured = await assessRenderedDocument(page, path, options);
    return measured.status === 'failed'
      ? { ...measured, browserErrors: await readErrors() }
      : measured;
  } catch (error) {
    return failedSample(String(error));
  }
}
async function assessRenderedDocument(
  page: Page,
  path: string,
  options: ResolvedOptions
): Promise<MeasurementSample> {
  const measured = assessDocument(
    await readDocument(page, options.quietMs, options.timeoutMs)
  );
  try {
    await requireRouteContent(page, path);
    return measured;
  } catch (error) {
    return {
      ...measured,
      status: 'failed',
      reason: [measured.reason, String(error)].filter(Boolean).join(' '),
      documentHtml: await page.content().catch(() => undefined),
    };
  }
}

export async function sampleRoute(
  browser: Browser,
  path: string,
  options: SampleOptions = {}
) {
  const settings = resolvedOptions(options);
  const cold: MeasurementSample[] = [];
  const warm: MeasurementSample[] = [];
  const transfers: {
    cold: Awaited<ReturnType<TransferLedger['drain']>>[];
    warm: Awaited<ReturnType<TransferLedger['drain']>>[];
  } = { cold: [], warm: [] };
  const count = settings.sampleCount;
  for (let index = 0; index < count; index++) {
    const context = await browser.newContext(settings.contextOptions);
    const page = await context.newPage();
    const readErrors = observeBrowserErrors(page);
    try {
      await authorizePreviewPage(
        page,
        settings.baseUrl,
        settings.extraHTTPHeaders
      );
      await installObservers(page);
      await page.bringToFront();
      const network = await observeTransfers(page);
      for (const [samples, phase] of [
        [cold, 'cold'],
        [warm, 'warm'],
      ] as const) {
        network.ledger.reset();
        const measured = await measureVisit(page, path, settings, readErrors);
        const transfer = await network.ledger.drain(
          settings.timeoutMs,
          settings.quietMs
        );
        samples.push(
          transfer.settlement.status === 'timeout'
            ? failedSample(pendingTransferReason(transfer.pending))
            : measured
        );
        transfers[phase].push(transfer);
        if (transfer.settlement.status === 'timeout') break;
      }
      await network.close();
    } finally {
      await context.close();
    }
  }
  return {
    ...summarizeSamples(cold, count),
    warm: summarizeSamples(warm, count),
    transfers,
  };
}

export async function sampleJourney(
  browser: Browser,
  journey: Journey,
  options: SampleOptions = {}
) {
  const settings = resolvedOptions(options);
  const context = await browser.newContext(settings.contextOptions);
  const page = await context.newPage();
  const readErrors = observeBrowserErrors(page);
  const steps = [];
  try {
    await authorizePreviewPage(
      page,
      settings.baseUrl,
      settings.extraHTTPHeaders
    );
    await installObservers(page);
    await page.bringToFront();
    const network = await observeTransfers(page);
    const first = journey.paths[0]!;
    const initial = await measureVisit(page, first, settings, readErrors);
    const initialTransfer = await network.ledger.drain(
      settings.timeoutMs,
      settings.quietMs
    );
    steps.push({ path: first, ...initial, transfer: initialTransfer });
    if (initial.status !== 'valid') throw new Error(initial.reason);
    if (initialTransfer.settlement.status === 'timeout')
      throw new Error(pendingTransferReason(initialTransfer.pending));
    for (const path of journey.paths.slice(1)) {
      const step = await measureJourneyStep(
        page,
        path,
        settings,
        network.ledger
      );
      steps.push(step);
      if (step.status === 'failed') throw new Error(step.reason);
    }
    return { status: initial.status, paths: journey.paths, steps };
  } catch (error) {
    return {
      status: 'failed',
      reason: String(error),
      paths: journey.paths,
      steps,
    };
  } finally {
    await context.close();
  }
}

async function navigateJourneyStep(
  page: Page,
  path: string,
  options: ResolvedOptions,
  startedAt: number
) {
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  await page
    .locator(`a[href="${path}"]`)
    .filter({ visible: true })
    .first()
    .click({ timeout: options.timeoutMs });
  await page.waitForURL((url) => url.pathname === path, {
    timeout: options.timeoutMs,
  });
  await page.waitForLoadState('load', { timeout: options.timeoutMs });
  const documentNavigation =
    (await page.evaluate(() => performance.timeOrigin)) !== timeOrigin;
  return {
    navigationMs: Math.round(performance.now() - startedAt),
    navigation: documentNavigation ? 'document' : 'client',
    paintMetrics: documentNavigation
      ? 'not-collected-for-journey-step'
      : 'not-applicable-to-client-navigation',
  };
}

async function measureJourneyStep(
  page: Page,
  path: string,
  options: ResolvedOptions,
  ledger: TransferLedger
) {
  ledger.reset();
  const startedAt = performance.now();
  let navigation: {
    navigationMs: number | null;
    navigation: string;
    paintMetrics: string;
  } = {
    navigationMs: null,
    navigation: 'unknown',
    paintMetrics: 'not-collected-for-failed-navigation',
  };
  let reason: string | undefined;
  try {
    navigation = await navigateJourneyStep(page, path, options, startedAt);
    await requireRouteContent(page, path, options.timeoutMs);
    await page.waitForTimeout(options.quietMs);
  } catch (error) {
    reason = String(error);
  }
  const transfer = await ledger.drain(options.timeoutMs, options.quietMs);
  if (transfer.settlement.status === 'timeout')
    reason ??= pendingTransferReason(transfer.pending);
  return {
    path,
    status: reason === undefined ? 'valid' : 'failed',
    reason,
    ...navigation,
    elapsedMs: Math.round(performance.now() - startedAt),
    transfer,
  };
}

function pendingTransferReason(pending: number): string {
  return `Network traffic did not reach a stable measurement window before the deadline (${pending} pending requests).`;
}
