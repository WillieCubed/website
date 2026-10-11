import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the status page keeps its clock and work when weather fails', async ({
  page,
}) => {
  await page.route('**/api/status', (route) =>
    route.fulfill({ status: 503, json: { weather: null } })
  );
  await page.goto('/status');
  await expect(
    page.getByRole('heading', { name: 'A little of life lately.' })
  ).toBeVisible();
  await expect(page.locator('.local-conditions__clock')).toContainText(
    /\d+:\d+/
  );
  await expect(page.locator('.local-conditions__weather')).toHaveText(
    'Weather unavailable'
  );
  await expect(
    page.getByRole('heading', { name: 'Keeping busy with' })
  ).toBeVisible();
  await expect(page.locator('.microstatus__weather')).toHaveCount(0);
});

test('weather remains pending independently of the content', async ({
  page,
}) => {
  let finish: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route('**/api/status', async (route) => {
    await gate;
    await route.fulfill({
      json: {
        weather: {
          temperature: 70,
          code: 0,
          isDay: false,
          observedAt: new Date().toISOString(),
        },
      },
    });
  });
  await page.goto('/status');
  await expect(page.locator('.local-conditions__weather')).toHaveText(
    'Checking the sky…'
  );
  await expect(
    page.getByRole('heading', { name: 'Keeping busy with' })
  ).toBeVisible();
  finish?.();
  await expect(page.locator('.local-conditions__weather')).toContainText(
    '70°F'
  );
  await expect(page.locator('.local-conditions__weather')).toContainText(
    'Clear skies'
  );
});

test('stale conditions disappear instead of looking current', async ({
  page,
}) => {
  await page.route('**/api/status', (route) =>
    route.fulfill({
      json: {
        weather: {
          temperature: 70,
          code: 0,
          isDay: true,
          observedAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
        },
      },
    })
  );
  await page.goto('/status');
  await expect(page.locator('.local-conditions__weather')).toHaveText(
    'Weather unavailable'
  );
  await expect(page.locator('.microstatus__weather')).toHaveCount(0);
});

test('the footer status becomes focusable with the opened footer and navigates', async ({
  page,
}) => {
  await page.goto('/');
  const status = page.locator('[data-footer-status]');
  await expect(status).toHaveJSProperty('inert', true);
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight)
  );
  await expect(status).toHaveJSProperty('inert', false);
  await expect(status).toHaveAccessibleName(
    /Current status: Las Vegas.*\d+:\d+/
  );
  await status.focus();
  await expect(status).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/status$/);
  await expect(page.locator('[data-footer-status]')).toHaveCount(0);
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`status fits supported sizes and passes axe in ${colorScheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.route('**/api/status', (route) =>
      route.fulfill({ status: 503, json: { weather: null } })
    );
    for (const width of [320, 390, 600, 768, 840, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/status');
      await expect(page.locator('.local-conditions__weather')).toHaveText(
        'Weather unavailable'
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true);
    }
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))
    ).toEqual([]);
  });
}
