import { type Page, expect, test } from '@playwright/test';

/**
 * The homepage detail view: a modal dialog whose open entry is mirrored in
 * `?detail=<id>`. Every way of closing it has to close it, whatever the URL
 * is doing at that moment, and closing has to leave history the way the
 * visitor found it.
 */

test.use({ viewport: { width: 1280, height: 900 } });

function detail(page: Page) {
  return page.locator('dialog.detail');
}

/** Waits out a morph; the page swaps snapshots in and out while it runs. */
function settled(page: Page) {
  return page.waitForFunction(
    () => !document.documentElement.matches(':active-view-transition')
  );
}

/**
 * The tiles are plain links to `?detail=` until React takes them over, and
 * a click before then reloads the page instead of opening in place. The
 * detail view's streamed copy also waits in a hidden container for up to
 * 300ms, before and after React renders its own in the page, so the view
 * is ready once the only dialog left is the one in the page.
 */
async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const cover = document.querySelector('#lvbt a.cover');
    return (
      !!cover &&
      Object.keys(cover).some((key) => key.startsWith('__react')) &&
      document.querySelectorAll('dialog.detail').length === 1 &&
      !!document.querySelector('.home > dialog.detail')
    );
  });
}

/**
 * Presses Escape once `dialog` is open and its opening morph is still
 * running, and fails if the key landed after the morph ended, when it
 * would only test an ordinary close.
 */
async function escapeMidMorph(page: Page, dialog: string) {
  await page.waitForFunction(
    (selector) =>
      !!document.querySelector<HTMLDialogElement>(selector)?.open &&
      document.documentElement.matches(':active-view-transition'),
    dialog
  );
  await page.evaluate(() => {
    const flags = window as Window & { escapedMidMorph?: boolean };
    window.addEventListener(
      'keydown',
      () => {
        flags.escapedMidMorph = document.documentElement.matches(
          ':active-view-transition'
        );
      },
      { capture: true, once: true }
    );
  });
  await page.keyboard.press('Escape');
  expect(
    await page.evaluate(
      () => (window as Window & { escapedMidMorph?: boolean }).escapedMidMorph
    )
  ).toBe(true);
}

async function open(page: Page, id = 'lvbt') {
  await page.locator(`#${id} a.cover`).click();
  await expect(detail(page)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`\\?detail=${id}$`));
  await settled(page);
}

const closers: [string, (page: Page) => Promise<void>][] = [
  [
    'the close button',
    (page) => detail(page).getByRole('button', { name: 'Close' }).click(),
  ],
  // The top left corner of the viewport is backdrop at this size.
  ['the backdrop', (page) => page.mouse.click(8, 8)],
  ['Escape', (page) => page.keyboard.press('Escape')],
];

for (const [name, close] of closers) {
  test(`${name} closes the detail view`, async ({ page }) => {
    await page.goto('/');
    await hydrated(page);
    await open(page);
    await close(page);
    await expect(detail(page)).toBeHidden();
    await expect(page).toHaveURL(/\/$/);
  });
}

test('closing before the URL catches up still closes', async ({ page }) => {
  await page.goto('/');
  await hydrated(page);
  // Hold the server round trip that `?detail=` needs, so the close lands
  // after the morph but before the URL changes.
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    (url) => url.searchParams.has('detail') && url.searchParams.has('_rsc'),
    async (route) => {
      await held;
      await route.continue().catch(() => undefined);
    }
  );
  await page.locator('#rtc a.cover').click();
  await expect(detail(page)).toBeVisible();
  await settled(page);
  await detail(page).getByRole('button', { name: 'Close' }).click();
  await expect(detail(page)).toBeHidden();
  release();
  await page.waitForTimeout(500);
  await expect(detail(page)).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
});

test('Escape during the opening morph closes once it ends', async ({
  page,
}) => {
  await page.goto('/');
  await hydrated(page);
  await page.locator('#transitmapper a.cover').click();
  await escapeMidMorph(page, 'dialog.detail');
  await settled(page);
  await expect(detail(page)).toBeHidden();
  await page.waitForTimeout(500);
  await expect(detail(page)).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
});

test('Back after closing leaves the page instead of reopening it', async ({
  page,
}) => {
  await page.goto('/writings');
  await page.goto('/');
  await hydrated(page);
  await open(page);
  await detail(page).getByRole('button', { name: 'Close' }).click();
  await expect(detail(page)).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/writings$/);
});

test('Back closes the view, and it closes again after Forward', async ({
  page,
}) => {
  await page.goto('/');
  await hydrated(page);
  await open(page);
  await page.goBack();
  await expect(detail(page)).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
  await settled(page);
  await page.goForward();
  await expect(detail(page)).toBeVisible();
  await settled(page);
  await page.mouse.click(8, 8);
  await expect(detail(page)).toBeHidden();
  await expect(page).toHaveURL(/\/$/);
});
