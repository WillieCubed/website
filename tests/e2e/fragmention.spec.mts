import { type Page, expect, test } from '@playwright/test';

import { skipUnlessPublished } from './published';

// components/site/Fragmention.tsx: a URL ending in ##some+words highlights
// the first visible place those words appear and scrolls it into view.

const PART = '/initiatives/fall-tour-2026/part-1';
const NOTE = '/writings/fall-tour-2026-begins';

interface Marked {
  text: string;
  inArticle: boolean;
  inHeading: boolean;
  inViewport: boolean;
}

/** What the fragmention highlight covers, or null when there is none. */
function marked(page: Page): Promise<Marked | null> {
  return page.evaluate(() => {
    const highlight = CSS.highlights.get('fragmention');
    const [range] = highlight ? [...highlight] : [];
    if (!(range instanceof Range)) return null;
    const parent = range.startContainer.parentElement;
    const box = range.getBoundingClientRect();
    return {
      text: range.toString(),
      inArticle: Boolean(parent?.closest('article')),
      inHeading: Boolean(parent?.closest('h1')),
      inViewport: box.top >= 0 && box.bottom <= window.innerHeight,
    };
  });
}

/** Fails the test on any uncaught error, such as a hydration mismatch. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('a fragmention highlights the words and scrolls them into view', async ({
  page,
  request,
}) => {
  await skipUnlessPublished(request, PART);
  const errors = watchErrors(page);
  await page.goto(`${PART}##boys+go+to+JUPITER`);
  await expect
    .poll(() => marked(page))
    .toEqual({
      text: 'Boys Go to Jupiter',
      // The words appear in the story before the milestones.
      inArticle: true,
      inHeading: false,
      inViewport: true,
    });
  expect(errors).toEqual([]);
});

test('a new fragmention moves the highlight and an empty hash clears it', async ({
  page,
  request,
}) => {
  await skipUnlessPublished(request, PART);
  await page.goto(`${PART}##boys+go+to+jupiter`);
  await expect
    .poll(async () => (await marked(page))?.text)
    .toBe('Boys Go to Jupiter');

  await page.evaluate(() => {
    window.location.hash = '##light+rail+network';
  });
  // The source wraps the line between "rail" and "network".
  await expect
    .poll(async () => (await marked(page))?.text.replace(/\s+/g, ' '))
    .toBe('light rail network');

  await page.evaluate(() => {
    window.location.hash = '#';
  });
  await expect.poll(() => marked(page)).toBeNull();
});

test('a note skips its hidden heading and highlights the visible text', async ({
  page,
  request,
}) => {
  await skipUnlessPublished(request, NOTE);
  const errors = watchErrors(page);
  await page.goto(`${NOTE}##fall+tour+2026+starts`);
  await expect
    .poll(() => marked(page))
    .toMatchObject({
      text: 'Fall Tour 2026 starts',
      inHeading: false,
      inViewport: true,
    });
  // The page hydrates the streamed text the server sent, untouched.
  expect(errors).toEqual([]);
});

test('coming back to a fragmention highlights it on the page on screen', async ({
  page,
  request,
}) => {
  await skipUnlessPublished(request, NOTE);
  const note = NOTE;
  await page.goto(`${note}##fall+tour+2026+starts`);
  await expect
    .poll(async () => (await marked(page))?.text)
    .toBe('Fall Tour 2026 starts');
  await page.getByRole('link', { name: 'Part 1', exact: true }).click();
  await expect(page).toHaveURL(PART);
  await expect.poll(() => marked(page)).toBeNull();

  // The note comes back from Next's cache while the part stays in the
  // document, hidden, so the search must skip the hidden page.
  await page.goBack();
  await expect
    .poll(() => marked(page))
    .toMatchObject({
      text: 'Fall Tour 2026 starts',
      inViewport: true,
    });
});

test('words that are not on the page highlight nothing', async ({ page }) => {
  await page.goto(`${PART}##no+such+words+here`);
  await expect(page.locator('h1')).toBeVisible();
  expect(await marked(page)).toBeNull();
});
