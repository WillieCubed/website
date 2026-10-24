import type { Page } from '@playwright/test';

import {
  type DocumentObservation,
  type LayoutShiftSample,
  calculateCls,
} from './preview-measurement.mts';

interface ObserverState {
  fcp: number | null;
  lcp: number | null;
  lastEntryAt: number;
  layoutShifts: LayoutShiftSample[];
  supported: DocumentObservation['supported'];
  hiddenDuringMeasurement: boolean;
}
declare global {
  interface Window {
    __cloudflarePerformanceMetrics?: ObserverState;
  }
}

export async function installObservers(page: Page) {
  await page.addInitScript(() => {
    const types = PerformanceObserver.supportedEntryTypes;
    const state: ObserverState = {
      fcp: null,
      lcp: null,
      lastEntryAt: performance.now(),
      layoutShifts: [],
      supported: {
        paint: types.includes('paint'),
        lcp: types.includes('largest-contentful-paint'),
        cls: types.includes('layout-shift'),
      },
      hiddenDuringMeasurement: document.visibilityState !== 'visible',
    };
    window.__cloudflarePerformanceMetrics = state;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible')
        state.hiddenDuringMeasurement = true;
    });
    if (state.supported.paint)
      new PerformanceObserver((list) => {
        const fcp = list
          .getEntries()
          .find((entry) => entry.name === 'first-contentful-paint');
        if (fcp) state.fcp = fcp.startTime;
        state.lastEntryAt = performance.now();
      }).observe({ type: 'paint', buffered: true });
    if (state.supported.lcp)
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) state.lcp = entry.startTime;
        state.lastEntryAt = performance.now();
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    if (state.supported.cls)
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          };
          state.layoutShifts.push({
            startTime: shift.startTime,
            value: shift.value,
            hadRecentInput: shift.hadRecentInput,
          });
        }
        state.lastEntryAt = performance.now();
      }).observe({ type: 'layout-shift', buffered: true });
  });
}

export async function readDocument(
  page: Page,
  quietMs: number,
  timeoutMs: number
): Promise<DocumentObservation> {
  await page.evaluate(
    async ({ quietMs, timeoutMs }) => {
      const deadline = performance.now() + timeoutMs;
      while (performance.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const state = window.__cloudflarePerformanceMetrics;
        if (!state)
          throw new Error('Performance observers did not initialize.');
        const pendingPaint =
          (state.supported.paint && state.fcp === null) ||
          (state.supported.lcp && state.lcp === null);
        if (!pendingPaint && performance.now() - state.lastEntryAt >= quietMs)
          return;
      }
    },
    { quietMs, timeoutMs }
  );
  const result = await page.evaluate(() => {
    const state = window.__cloudflarePerformanceMetrics;
    if (!state) throw new Error('Performance observers did not initialize.');
    const navigation = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined;
    return {
      ttfbMs: navigation
        ? navigation.responseStart - navigation.requestStart
        : null,
      fcpMs: state.fcp,
      lcpMs: state.lcp,
      layoutShifts: state.layoutShifts,
      supported: state.supported,
      visibility: document.visibilityState,
      hiddenDuringMeasurement: state.hiddenDuringMeasurement,
    };
  });
  return {
    ...result,
    cls: result.supported.cls ? calculateCls(result.layoutShifts) : null,
  };
}
