import type { Page } from '@playwright/test';

export async function requireRenderedContent(page: Page) {
  const rendered = await page.evaluate(() => {
    const main = document.querySelector<HTMLElement>('main, [role="main"]');
    return (
      main?.checkVisibility({
        checkOpacity: true,
        checkVisibilityCSS: true,
      }) === true && main.innerText.trim().length > 0
    );
  });
  if (!rendered)
    throw new Error(
      'Expected rendered main content is missing, hidden or empty.'
    );
}
