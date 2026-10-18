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
  const initialRefresh = page.waitForResponse('**/api/status');
  await page.goto('/status');
  await initialRefresh;
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
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth
      )
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

test('missing weather shows a pending state during refresh and an error only after failure', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const location = {
    city: 'Las Vegas',
    region: 'Nevada',
    country: 'United States',
    timezone: 'America/Los_Angeles',
    updatedAt: null,
  };
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let delayRefresh = false;
  await page.route('**/api/status', async (route) => {
    if (!delayRefresh) {
      await route.fulfill({ json: { location, weather: null } });
    } else {
      await pending;
      await route.fulfill({
        json: {
          location,
          weather: {
            temperature: 72,
            unit: 'F',
            code: 0,
            isDay: true,
            observedAt: new Date().toISOString(),
          },
        },
      });
    }
  });
  await page.goto('/status');
  await expect(
    page.getByText('Weather unavailable', { exact: true })
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('weather-unavailable.png'),
  });
  delayRefresh = true;
  const retry = page.waitForRequest('**/api/status');
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange'))
  );
  await retry;
  await expect(
    page.getByText('Loading weather…', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText('Weather unavailable', { exact: true })
  ).not.toBeVisible();
  await expect(page.locator('h1')).toContainText('Las Vegas');
  await page.screenshot({ path: testInfo.outputPath('weather-pending.png') });
  release();
  await expect(page.locator('button.weather-reading')).toContainText('72');
  await expect(
    page.getByText('Loading weather…', { exact: true })
  ).not.toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('weather-loaded.png') });
});

test('footer status adapts without overlapping compact targets even with a long city name', async ({
  page,
}) => {
  await page.route('**/api/status', (route) =>
    route.fulfill({
      json: {
        location: {
          city: 'Llanfairpwllgwyngyll',
          region: 'Wales',
          country: 'United Kingdom',
          timezone: 'Europe/London',
          updatedAt: null,
        },
        weather: {
          temperature: 102,
          unit: 'F',
          code: 0,
          isDay: true,
          observedAt: new Date().toISOString(),
        },
      },
    })
  );
  await page.goto('/');
  const status = page.locator('.microstatus');
  await expect(status.locator('.status-city')).toHaveText(
    'Llanfairpwllgwyngyll'
  );
  for (const width of [300, 320, 390, 600, 840, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight)
    );
    await expect
      .poll(() =>
        page.locator('.site-footer__row').evaluate((row) => {
          const controls = [
            row.querySelector('.site-footer__profiles')!,
            row.querySelector('.microstatus')!,
            row.querySelector('.feeds-button')!,
          ];
          const [profiles, status, feeds] = controls.map((e) =>
            e.getBoundingClientRect()
          );
          const lastContact = Math.max(
            ...[...controls[0].querySelectorAll('a')]
              .filter((e) => e.getClientRects().length > 0)
              .map((e) => e.getBoundingClientRect().right)
          );
          return (
            Math.abs(
              profiles.y + profiles.height / 2 - status.y - status.height / 2
            ) < 1 &&
            lastContact <= status.x &&
            Math.abs(
              status.y + status.height / 2 - feeds.y - feeds.height / 2
            ) < 1 &&
            feeds.x - status.right >= 8 &&
            document.documentElement.scrollWidth <= innerWidth
          );
        })
      )
      .toBe(true);
    await expect(status.locator('.temperature')).toBeVisible();
    const containment = await status.evaluate((element) => {
      const target = element.getBoundingClientRect();
      const parts = [...element.children]
        .map((part) => part.getBoundingClientRect())
        .filter((part) => part.width > 0);
      return parts.every(
        (part) =>
          part.left - target.left >= 12 && target.right - part.right >= 12
      );
    });
    expect(containment, `${width}px status content fits its container`).toBe(
      true
    );
    if (await status.locator('.weather-picture').isVisible()) {
      const weatherGap = await status
        .locator('.microstatus-weather')
        .evaluate((group) => {
          const icon = group.querySelector('svg')!.getBoundingClientRect();
          return (
            group.querySelector('.temperature')!.getBoundingClientRect().left -
            icon.right
          );
        });
      expect(weatherGap).toBeGreaterThanOrEqual(4);
    }
    await expect(
      page.getByRole('button', { name: 'Feeds', exact: true })
    ).toBeVisible();
  }
});

test('the footer keeps weather readable and city text fitted across breakpoints', async ({
  page,
}) => {
  await page.route('**/api/status', (route) =>
    route.fulfill({
      json: {
        location: {
          city: 'Las Vegas',
          region: 'Nevada',
          country: 'United States',
          timezone: 'America/Los_Angeles',
          updatedAt: null,
        },
        weather: {
          temperature: 102,
          unit: 'F',
          code: 0,
          isDay: true,
          observedAt: new Date().toISOString(),
        },
      },
    })
  );
  await page.goto('/');
  const city = page.locator('.microstatus .status-city');
  await expect(page.locator('.microstatus .temperature')).toContainText('102');
  for (const width of [
    320, 390, 440, 441, 520, 559, 560, 561, 600, 839, 840, 880, 900, 920, 960,
    1000, 1024, 1040, 1080, 1100, 1120, 1140, 1160, 1199, 1200, 1280, 1366,
    1440, 1600,
  ]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight)
    );
    await expect(page.locator('.microstatus .temperature')).toBeVisible();
    await expect
      .poll(
        () =>
          city.evaluate(
            (element) => element.scrollWidth <= element.clientWidth
          ),
        { message: `City name should fit at ${width}px` }
      )
      .toBe(true);
  }
});
