import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
} from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { authorizePreviewPage } from './preview-auth.mts';

interface ScreenshotOptions {
  baseUrl: string;
  routes: string[];
  outputDirectory: string;
  settleMs?: number;
  imageDecodeTimeoutMs?: number;
  contextOptions?: Pick<
    BrowserContextOptions,
    'extraHTTPHeaders' | 'storageState'
  >;
}
interface CaptureVariant {
  viewport: { width: number; height: number };
  theme: 'light' | 'dark';
}
interface ScreenshotCapture extends CaptureVariant {
  path: string;
  status: 'valid' | 'failed';
  httpStatus: number | null;
  file: string | null;
  reason?: string;
}
const VARIANTS: CaptureVariant[] = [
  { viewport: { width: 1440, height: 1000 }, theme: 'light' },
  { viewport: { width: 1440, height: 1000 }, theme: 'dark' },
  { viewport: { width: 390, height: 844 }, theme: 'light' },
  { viewport: { width: 390, height: 844 }, theme: 'dark' },
];

async function settleScreenshot(
  page: Page,
  settleMs: number,
  imageDecodeTimeoutMs: number
) {
  await page.evaluate(async (decodeTimeoutMs) => {
    await Promise.race([
      document.fonts.ready,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Fonts did not settle within 10000ms.')),
          10_000
        )
      ),
    ]);
    await Promise.all(
      [...document.images]
        .filter((image) => {
          const rect = image.getBoundingClientRect();
          const style = getComputedStyle(image);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < innerHeight &&
            rect.left < innerWidth &&
            style.visibility !== 'hidden' &&
            style.display !== 'none'
          );
        })
        .map(async (image) => {
          const url = new URL(image.currentSrc || image.src, location.href);
          try {
            await Promise.race([
              image.decode(),
              new Promise((_, reject) =>
                setTimeout(
                  () =>
                    reject(
                      new Error(
                        `Image decoding did not settle within ${decodeTimeoutMs}ms.`
                      )
                    ),
                  decodeTimeoutMs
                )
              ),
            ]);
          } catch (error) {
            if (url.origin === location.origin)
              throw new Error(
                `Expected local image failed to decode: ${url.pathname}${url.search}. ${String(error)}`,
                { cause: error }
              );
          }
        })
    );
  }, imageDecodeTimeoutMs);
  await page.waitForTimeout(settleMs);
}

async function captureRoute(
  context: BrowserContext,
  path: string,
  variant: CaptureVariant,
  options: ScreenshotOptions,
  headers?: Record<string, string>
): Promise<ScreenshotCapture> {
  const page = await context.newPage();
  const result: ScreenshotCapture = {
    ...variant,
    path,
    status: 'failed',
    httpStatus: null,
    file: null,
  };
  try {
    await authorizePreviewPage(page, options.baseUrl, headers);
    await page.bringToFront();
    const response = await page.goto(new URL(path, options.baseUrl).href, {
      waitUntil: 'load',
      timeout: 30_000,
    });
    result.httpStatus = response?.status() ?? null;
    await settleScreenshot(
      page,
      options.settleMs ?? 300,
      options.imageDecodeTimeoutMs ?? 30_000
    );
    const routeName = path === '/' ? 'home' : encodeURIComponent(path.slice(1));
    const file = `${routeName}-${variant.viewport.width}x${variant.viewport.height}-${variant.theme}.png`;
    await page.screenshot({
      path: join(options.outputDirectory, file),
      fullPage: false,
      animations: 'disabled',
      timeout: 30_000,
    });
    result.file = file;
    if (!response?.ok())
      throw new Error(
        `Screenshot route ${path} returned HTTP ${result.httpStatus ?? 'no response'}.`
      );
    result.status = 'valid';
  } catch (error) {
    result.reason = String(error);
  } finally {
    await page.close();
  }
  return result;
}

export async function capturePreviewScreenshots(
  browser: Browser,
  options: ScreenshotOptions
) {
  await mkdir(options.outputDirectory, { recursive: true });
  const captures: ScreenshotCapture[] = [];
  const headers = options.contextOptions?.extraHTTPHeaders;
  const report = {
    status: 'valid',
    capturedAt: new Date().toISOString(),
    targetUrl: options.baseUrl,
    expected: options.routes.length * VARIANTS.length,
    captured: 0,
    captures,
  };
  for (const variant of VARIANTS) {
    const context = await browser.newContext({
      storageState: options.contextOptions?.storageState,
      viewport: variant.viewport,
      colorScheme: variant.theme,
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      isMobile: variant.viewport.width < 600,
      hasTouch: variant.viewport.width < 600,
    });
    try {
      for (const path of options.routes) {
        const capture = await captureRoute(
          context,
          path,
          variant,
          options,
          headers
        );
        captures.push(capture);
        if (capture.file !== null) report.captured += 1;
        if (capture.status === 'failed') report.status = 'failed';
        await writeFile(
          join(options.outputDirectory, 'manifest.json'),
          `${JSON.stringify(report, null, 2)}\n`
        );
      }
    } finally {
      await context.close();
    }
  }
  return report;
}
