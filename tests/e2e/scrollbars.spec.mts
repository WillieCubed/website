import { type Page, expect, test } from '@playwright/test';

/**
 * Scrollbars follow the theme
 * (docs/superpowers/specs/2026-09-28-scrollbars-design.md). Headless
 * Chromium hides scrollbars, so these read the computed properties rather
 * than pixels.
 */

test.use({ viewport: { width: 1280, height: 900 } });

function computed(page: Page, selector: string, property: string) {
  return page.evaluate(
    ([selector, property]) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Nothing matches ${selector}.`);
      return getComputedStyle(element).getPropertyValue(property);
    },
    [selector, property]
  );
}

test('the page draws a themed thumb', async ({ page }) => {
  await page.goto('/');
  expect(await computed(page, 'html', 'scrollbar-color')).not.toBe('auto');
});

test('the page keeps its scrollbar gutter under the detail view', async ({
  page,
}) => {
  await page.goto('/?detail=lvbt');
  await expect(page.locator('dialog.detail')).toBeVisible();
  expect(await computed(page, 'html', 'overflow')).toBe('hidden');
  expect(await computed(page, 'html', 'scrollbar-gutter')).toBe('stable');
});

test('the detail view scrolls with a thin bar in its venture colours', async ({
  page,
}) => {
  await page.goto('/?detail=transitmapper');
  await expect(page.locator('dialog.detail')).toBeVisible();
  expect(await computed(page, 'dialog.detail', 'scrollbar-width')).toBe('thin');
  const root = await computed(page, 'html', 'scrollbar-color');
  const dialog = await computed(page, 'dialog.detail', 'scrollbar-color');
  expect(dialog).not.toBe('auto');
  expect(dialog).not.toBe(root);
});

test('the command palette results scroll with a thin bar', async ({ page }) => {
  await page.goto('/');
  await page.locator('.palette-trigger').first().click();
  await expect(page.locator('.palette-list')).toBeVisible();
  expect(await computed(page, '.palette-list', 'scrollbar-width')).toBe('thin');
  expect(await computed(page, '.palette-list', 'scrollbar-color')).not.toBe(
    'auto'
  );
});
