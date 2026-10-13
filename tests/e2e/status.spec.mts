import { expect, test } from '@playwright/test';

test('status content is present in the initial HTML without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const page = await browser.newPage({
    javaScriptEnabled: false,
    baseURL,
    viewport: { width: 390, height: 844 },
  });
  const response = await page.goto('/status');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Willie is currently'
  );
  await expect(page.locator('.weather-picture').first()).toBeVisible();
  await expect(page.getByText('Loading status…')).toHaveCount(0);
  await expect(page.locator('.status-expanded .clock')).toBeHidden();
  await page.close();
});

test('a delayed status refresh preserves the content on a narrow screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/status');
  await expect(page.locator('.clock time')).not.toHaveText('—');
  const heading = await page.locator('h1').innerText();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/status', async (route) => {
    await pending;
    await route.fulfill({
      json: {
        location: {
          city: 'Las Vegas',
          region: 'Nevada',
          country: 'United States',
          timezone: 'America/Los_Angeles',
          updatedAt: null,
        },
        weather: {
          temperature: 72,
          unit: 'F',
          code: 0,
          isDay: true,
          observedAt: new Date().toISOString(),
        },
      },
    });
  });
  const requested = page.waitForRequest('**/api/status');
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange'))
  );
  await requested;
  await expect(page.locator('h1')).toHaveText(heading);
  await expect(page.getByText('Loading status…')).toHaveCount(0);
  release();
  const reading = page.locator('button.weather-reading');
  await reading.click();
  await expect(reading.locator('.unit')).toHaveText('C');
  await expect
    .poll(() =>
      page.locator('.status-expanded .weather-picture').evaluate((picture) => {
        const background = picture
          .querySelector('.sky-glyph > polygon')!
          .getBoundingClientRect();
        const face = picture
          .querySelector('.weather-face')!
          .getBoundingClientRect();
        return Math.max(
          Math.abs(
            face.x + face.width / 2 - background.x - background.width / 2
          ),
          Math.abs(
            face.y + face.height / 2 - background.y - background.height / 2
          )
        );
      })
    )
    .toBeLessThan(1);

  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    )
    .toBe(true);
  await reading.hover();
  await expect
    .poll(() =>
      reading.evaluate(
        (element) => new DOMMatrix(getComputedStyle(element).transform).b
      )
    )
    .toBe(0);
});
