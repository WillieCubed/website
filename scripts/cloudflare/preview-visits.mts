import type { Browser, BrowserContextOptions, Page } from '@playwright/test';

import {
  type MeasurementSample,
  assessDocument,
  failedSample,
  summarizeSamples,
} from './preview-measurement.mts';
import { installObservers, readDocument } from './preview-observers.mts';
import { type TransferLedger, observeTransfers } from './preview-transfers.mts';

export const BASE_URL = 'http://127.0.0.1:8787';
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
  contextOptions?: BrowserContextOptions;
}
interface Journey {
  name: string;
  paths: string[];
}
function resolvedOptions(options: SampleOptions): ResolvedOptions {
  return {
    baseUrl: options.baseUrl ?? BASE_URL,
    sampleCount: options.sampleCount ?? SAMPLE_COUNT,
    quietMs: options.quietMs ?? 1_000,
    timeoutMs: options.timeoutMs ?? 30_000,
    contextOptions: options.contextOptions,
  };
}
async function measureVisit(
  page: Page,
  path: string,
  options: ResolvedOptions
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
    return assessDocument(
      await readDocument(page, options.quietMs, options.timeoutMs)
    );
  } catch (error) {
    return failedSample(String(error));
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
    try {
      await installObservers(page);
      await page.bringToFront();
      const network = await observeTransfers(page);
      for (const [samples, phase] of [
        [cold, 'cold'],
        [warm, 'warm'],
      ] as const) {
        network.ledger.reset();
        const measured = await measureVisit(page, path, settings);
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
  const steps = [];
  try {
    await installObservers(page);
    await page.bringToFront();
    const network = await observeTransfers(page);
    const first = journey.paths[0]!;
    const response = await page.goto(new URL(first, settings.baseUrl).href, {
      waitUntil: 'load',
      timeout: settings.timeoutMs,
    });
    if (!response?.ok())
      throw new Error(
        `Journey entry ${first} returned ${response?.status() ?? 'no response'}.`
      );
    const initial = assessDocument(
      await readDocument(page, settings.quietMs, settings.timeoutMs)
    );
    const initialTransfer = await network.ledger.drain(
      settings.timeoutMs,
      settings.quietMs
    );
    steps.push({ path: first, ...initial, transfer: initialTransfer });
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
      if (step.transfer.settlement.status === 'timeout')
        throw new Error(pendingTransferReason(step.transfer.pending));
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

async function measureJourneyStep(
  page: Page,
  path: string,
  options: ResolvedOptions,
  ledger: TransferLedger
) {
  ledger.reset();
  const startedAt = performance.now();
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  const link = page
    .locator(`a[href="${path}"]`)
    .filter({ visible: true })
    .first();
  await link.click({ timeout: options.timeoutMs });
  await page.waitForURL((url) => url.pathname === path, {
    timeout: options.timeoutMs,
  });
  await page.waitForLoadState('load', { timeout: options.timeoutMs });
  const navigationMs = Math.round(performance.now() - startedAt);
  await page.waitForTimeout(options.quietMs);
  const documentNavigation =
    (await page.evaluate(() => performance.timeOrigin)) !== timeOrigin;
  const transfer = await ledger.drain(options.timeoutMs, options.quietMs);
  return {
    path,
    status: transfer.settlement.status === 'timeout' ? 'failed' : 'valid',
    navigationMs,
    elapsedMs: Math.round(performance.now() - startedAt),
    navigation: documentNavigation ? 'document' : 'client',
    paintMetrics: documentNavigation
      ? 'not-collected-for-journey-step'
      : 'not-applicable-to-client-navigation',
    transfer,
  };
}

function pendingTransferReason(pending: number): string {
  return `Network traffic did not reach a stable measurement window before the deadline (${pending} pending requests).`;
}
