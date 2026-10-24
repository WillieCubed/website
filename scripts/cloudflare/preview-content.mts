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

const ROUTE_HEADINGS: Record<string, string> = {
  '/': 'Willie Chalmers III builds software and systems for people.',
  '/search': 'Search',
  '/writings': 'Writings',
  '/initiatives': 'Initiatives',
  '/projects': 'Projects',
  '/music': 'Music',
};

async function rejectApplicationError(page: Page) {
  if (
    (await page
      .getByRole('heading', {
        level: 1,
        name: 'Something went wrong.',
        exact: true,
      })
      .isVisible()) &&
    (await page
      .getByText('The site hit a server error.', { exact: true })
      .isVisible())
  )
    throw new Error(
      'Application error boundary rendered instead of route content.'
    );
}

export async function requireRouteContent(
  page: Page,
  path: string,
  timeoutMs = 0
) {
  await rejectApplicationError(page);
  const expected = ROUTE_HEADINGS[path];
  if (expected) {
    const heading = page.getByRole('heading', {
      level: 1,
      name: expected,
      exact: true,
    });
    if (timeoutMs > 0)
      await heading.waitFor({ state: 'visible', timeout: timeoutMs });
    else if (!(await heading.isVisible()))
      throw new Error(
        `Expected route heading "${expected}" is missing or hidden.`
      );
  }
  await requireRenderedContent(page);
  await rejectApplicationError(page);
}
