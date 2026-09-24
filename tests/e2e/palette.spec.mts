import AxeBuilder from '@axe-core/playwright';
import { type Page, expect, test } from '@playwright/test';

/**
 * The command palette. Every page gets the ⌘K / Ctrl+K shortcut from the
 * root layout, and the palette accepts either modifier on any platform, so
 * these press ControlOrMeta rather than guess the emulated device's.
 */

// The rail hides its trigger on desktop windows under 721px tall, where
// the sticky rail has no room for it, and Desktop Chrome is 720px.
test.use({ viewport: { width: 1280, height: 900 } });

/** Waits out the open or close morph; the palette ignores keys during it. */
function settled(page: Page) {
  return page.waitForFunction(
    () => !document.documentElement.matches(':active-view-transition')
  );
}

function palette(page: Page) {
  return page.getByRole('dialog', { name: 'Command palette' });
}

function combobox(page: Page) {
  return palette(page).getByRole('combobox');
}

for (const path of ['/', '/writings']) {
  test(`⌘K opens the palette on ${path}`, async ({ page }) => {
    await page.goto(path);
    // The shortcut is registered once the page hydrates, as the trigger is.
    await expect(page.locator('.palette-trigger').first()).toBeVisible();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(palette(page)).toBeVisible();
    await expect(combobox(page)).toBeFocused();
    await expect(
      palette(page).getByRole('option', { name: /Writings/ })
    ).toBeVisible();
    await settled(page);
    await page.keyboard.press('ControlOrMeta+k');
    await expect(palette(page)).toBeHidden();
  });
}

test('a query returns Pagefind results with the hit marked', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('.palette-trigger').first().click();
  // Only a venture's detail text says "journal", so the match can come from
  // the search index alone, not from a command's title.
  await combobox(page).fill('journal');
  const result = palette(page).getByRole('option', { name: /^LogDate/ });
  await expect(result).toBeVisible();
  await expect(result.locator('mark').first()).toHaveText(/journal/i);
  await expect(
    palette(page).getByRole('group', { name: 'Pages' })
  ).toBeVisible();
});

test('brew sends a real POST /coffee and shows the 418', async ({ page }) => {
  await page.goto('/');
  await page.locator('.palette-trigger').first().click();
  const request = page.waitForResponse(
    (response) =>
      response.url().endsWith('/coffee') &&
      response.request().method() === 'POST'
  );
  await combobox(page).fill('brew');
  // An egg is never listed; Enter runs the exact name that was typed.
  await expect(palette(page).getByRole('option', { name: 'brew' })).toHaveCount(
    0
  );
  await page.keyboard.press('Enter');
  expect((await request).status()).toBe(418);
  const readout = palette(page).getByRole('region', { name: 'Command output' });
  await expect(readout).toContainText('HTTP 418');
  await expect(readout).toContainText('x-clacks-overhead');
  await expect(readout).toContainText("418 I'm a teapot");
  await expect(palette(page).getByRole('status')).toContainText('418');
});

test('Escape closes the palette and returns focus to its trigger', async ({
  page,
}) => {
  await page.goto('/');
  const trigger = page.locator('.palette-trigger').first();
  await trigger.click();
  await expect(combobox(page)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(combobox(page)).toHaveAttribute(
    'aria-activedescendant',
    /option-1$/
  );
  await settled(page);
  await page.keyboard.press('Escape');
  await expect(palette(page)).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('the open palette passes axe', async ({ page }) => {
  await page.goto('/');
  await page.locator('.palette-trigger').first().click();
  await expect(combobox(page)).toBeFocused();
  // Let the morph finish so axe reads the settled dialog.
  await settled(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include('dialog.palette')
    .analyze();
  const summary = violations.map(
    ({ id, impact, nodes }) =>
      `${id} (${impact}): ${nodes.map((node) => node.target.join(' ')).join(', ')}`
  );
  expect(summary).toEqual([]);
});
