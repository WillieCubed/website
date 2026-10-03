import { type Page, expect, test } from '@playwright/test';

/**
 * Scrollbars follow the theme
 * (docs/superpowers/specs/2026-09-28-scrollbars-design.md). Headless
 * Chromium hides scrollbars, so these read the computed properties rather
 * than pixels.
 */

// Tall enough that the homepage rail shows its search row, which short
// desktop windows hide (components/palette/palette.css).
test.use({ viewport: { width: 1280, height: 1000 } });

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

test('the detail card scrolls its text column clear of its corners', async ({
  page,
}) => {
  await page.goto('/?detail=rtc');
  await expect(page.locator('dialog.detail')).toBeVisible();
  const layout = await page.evaluate(() => {
    const dialog = document.querySelector('dialog.detail')!;
    const column = document.querySelector('.d-content')!;
    const card = dialog.getBoundingClientRect();
    const box = column.getBoundingClientRect();
    return {
      dialogOverflow: getComputedStyle(dialog).overflowY,
      columnOverflow: getComputedStyle(column).overflowY,
      top: box.top - card.top,
      bottom: card.bottom - box.bottom,
      radius: parseFloat(getComputedStyle(dialog).borderTopRightRadius),
    };
  });
  expect(layout.dialogOverflow).toBe('hidden');
  expect(layout.columnOverflow).toBe('auto');
  // Twelve pixels down, an 18px corner has curved in by about a pixel, so a
  // bar that starts there stays inside the card.
  expect(layout.top).toBeGreaterThanOrEqual(12);
  expect(layout.bottom).toBeGreaterThanOrEqual(12);
  expect(layout.radius).toBe(18);
});

test('below 840px the detail view fills the window with square corners', async ({
  page,
}) => {
  await page.setViewportSize({ width: 760, height: 900 });
  await page.goto('/?detail=rtc');
  await expect(page.locator('dialog.detail')).toBeVisible();
  const view = await page.evaluate(() => {
    const dialog = document.querySelector('dialog.detail')!;
    const box = dialog.getBoundingClientRect();
    return {
      width: Math.round(box.width),
      height: Math.round(box.height),
      radius: getComputedStyle(dialog).borderTopRightRadius,
      overflow: getComputedStyle(dialog).overflowY,
    };
  });
  expect(view).toEqual({
    width: 760,
    height: 900,
    radius: '0px',
    overflow: 'auto',
  });
});
