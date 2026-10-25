import type { Page } from '@playwright/test';

/** The collector uses CDP because Playwright routing disables HTTP caching. */
export async function authorizePreviewPage(
  page: Page,
  baseUrl: string,
  headers: Record<string, string> = {}
) {
  if (Object.keys(headers).length === 0) return;
  const origin = new URL(baseUrl).origin;
  const session = await page.context().newCDPSession(page);
  session.on('Fetch.requestPaused', ({ requestId, request }) => {
    const merged = new Map(
      Object.entries(request.headers).map(([name, value]) => [
        name.toLowerCase(),
        value,
      ])
    );
    for (const [name, value] of Object.entries(headers))
      merged.set(name.toLowerCase(), value);
    // Fetch overrides apply to this hop only, so cross-origin redirects receive no credentials.
    void session
      .send('Fetch.continueRequest', {
        requestId,
        headers: [...merged].map(([name, value]) => ({ name, value })),
      })
      .catch(() => {
        // Closing the page fails the capture without recording credential parameters.
        void page.close().catch(() => undefined);
      });
  });
  await session.send('Fetch.enable', {
    patterns: [{ urlPattern: `${origin}/*`, requestStage: 'Request' }],
  });
}
