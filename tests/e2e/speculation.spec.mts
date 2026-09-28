import { expect, test } from '@playwright/test';

// lib/speculation-rules.ts. Chromium reports every link a document rule
// picks up through the DevTools Preload domain, whether or not the visitor
// has shown intent yet, so the test reads the candidates straight from it.

interface AttemptSource {
  key: { action: string; url: string };
}

test('the speculation rules prefetch in-site pages and nothing else', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'the Preload domain is Chromium’s');
  const cdp = await page.context().newCDPSession(page);
  const errors: string[] = [];
  let sources: AttemptSource[] = [];
  cdp.on('Preload.ruleSetUpdated', ({ ruleSet }) => {
    if (ruleSet.errorType) errors.push(ruleSet.errorMessage ?? '');
  });
  cdp.on(
    'Preload.preloadingAttemptSourcesUpdated',
    ({ preloadingAttemptSources }) => {
      sources = preloadingAttemptSources;
    }
  );
  await cdp.send('Preload.enable');

  await page.goto('/');
  const candidates = () =>
    sources.map(({ key }) => `${key.action} ${new URL(key.url).pathname}`);

  await expect.poll(candidates).toContain('Prefetch /writings');
  const found = candidates();
  expect(errors).toEqual([]);
  expect(found.every((entry) => entry.startsWith('Prefetch '))).toBe(true);
  // The footer's feeds menu links the feeds; none of them is a page.
  await expect(page.locator('a[href="/feed.xml"]')).toHaveCount(1);
  for (const path of ['/feed.xml', '/feed/atom', '/feed/json']) {
    expect(found).not.toContain(`Prefetch ${path}`);
  }
  const origin = new URL(page.url()).origin;
  expect(sources.every(({ key }) => new URL(key.url).origin === origin)).toBe(
    true
  );
});
