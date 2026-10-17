import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  test.skip(
    !process.env.STANDARD_SOCIAL_FIXTURE,
    'Requires isolated social fixtures.'
  );
  await page.route('**/api/atproto/social*', (route) =>
    route.fulfill({
      json: { enabled: true, ready: true, signedIn: true, subscribed: false },
    })
  );
});

test('failed and malformed mutations retain the last confirmed state', async ({
  page,
}) => {
  let response: { status: number; json: Record<string, boolean> } = {
    status: 200,
    json: {},
  };
  await page.route('**/api/atproto/subscription', (route) =>
    route.fulfill(response)
  );
  await page.goto('/writings');
  await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
  const retrySubscribe = page.getByRole('button', {
    name: 'Try again to subscribe',
    exact: true,
  });
  await expect(retrySubscribe).toHaveAttribute('aria-pressed', 'false');

  response = { status: 200, json: { active: true } };
  await retrySubscribe.click();
  const subscribed = page.getByRole('button', {
    name: 'Subscribed',
    exact: true,
  });
  await expect(subscribed).toHaveAttribute('aria-pressed', 'true');

  response = { status: 502, json: {} };
  await subscribed.click();
  const retryUnsubscribe = page.getByRole('button', {
    name: 'Try again to unsubscribe',
    exact: true,
  });
  await expect(retryUnsubscribe).toHaveAttribute('aria-pressed', 'true');

  response = { status: 200, json: { active: false } };
  await retryUnsubscribe.click();
  await expect(
    page.getByRole('button', { name: 'Subscribe', exact: true })
  ).toHaveAttribute('aria-pressed', 'false');
});

test('rate limiting waits before retry and unavailable actions stay disabled', async ({
  page,
}) => {
  await page.clock.install();
  let status = 429;
  await page.route('**/api/atproto/subscription', (route) =>
    route.fulfill({ status, json: {} })
  );
  await page.goto('/writings');
  await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
  const waiting = page.getByRole('button', {
    name: 'Wait a moment',
    exact: true,
  });
  await expect(waiting).toBeDisabled();
  await page.clock.fastForward(500);
  const waitingBounds = (await waiting.boundingBox())!;
  const disabledStyle = await waiting.evaluate((element) => {
    const style = getComputedStyle(element);
    return { radius: style.borderRadius, fill: style.backgroundColor };
  });
  await page.mouse.move(
    waitingBounds.x + waitingBounds.width / 2,
    waitingBounds.y + waitingBounds.height / 2
  );
  await page.mouse.down();
  try {
    await page.clock.fastForward(500);
    expect(
      await waiting.evaluate((element) => {
        const style = getComputedStyle(element);
        return { radius: style.borderRadius, fill: style.backgroundColor };
      })
    ).toEqual(disabledStyle);
    expect(await waiting.boundingBox()).toEqual(waitingBounds);
  } finally {
    await page.mouse.up();
  }
  await page.clock.fastForward(60_000);
  const subscribe = page.getByRole('button', {
    name: 'Subscribe',
    exact: true,
  });
  await expect(subscribe).toBeEnabled();

  status = 409;
  await subscribe.click();
  const unavailable = page.getByRole('button', {
    name: 'Unavailable',
    exact: true,
  });
  await expect(unavailable).toBeDisabled();
  await expect(unavailable).toHaveAttribute('aria-pressed', 'false');
});

test('an unconfirmed callback offers retry and expired authorization requests sign-in', async ({
  page,
}) => {
  await page.route('**/api/atproto/subscription', (route) =>
    route.fulfill({ status: 401, json: {} })
  );
  await page.goto('/writings?atprotoError=cancelled');
  await page
    .getByRole('button', { name: 'Try again to subscribe', exact: true })
    .click();
  await expect(page).toHaveURL(/\/writings$/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Your handle')).toBeFocused();
  await page.keyboard.press('Escape');
  const subscribe = page.getByRole('button', {
    name: 'Subscribe',
    exact: true,
  });
  await expect(subscribe).toHaveAttribute('aria-pressed', 'false');
  await expect(subscribe).toBeFocused();
});

test('connected social controls separate focus, press and confirmed selection', async ({
  page,
}, testInfo) => {
  await page.route('**/api/atproto/social*', (route) =>
    route.fulfill({
      json: { enabled: true, ready: true, signedIn: true, subscribed: true },
    })
  );
  await page.route('**/api/atproto/subscription', (route) =>
    route.fulfill({ json: { active: false } })
  );
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
      await page.emulateMedia({ reducedMotion });
      await page.goto('/writings');
      const action = page.getByRole('button', {
        name: 'Subscribed',
        exact: true,
      });
      const arrow = page.getByRole('button', {
        name: 'Subscription options',
        exact: true,
      });
      await expect(action).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('Tab');
      await action.focus();
      const focused = await action.evaluate((element) => {
        const style = getComputedStyle(element);
        return { radius: style.borderRadius, outline: style.outlineWidth };
      });
      expect(focused.outline).toBe('3px');
      expect(focused.radius).not.toBe('8px');
      const target = (await action.boundingBox())!;
      const neighbor = (await arrow.boundingBox())!;
      expect(target.height).toBeGreaterThanOrEqual(48);
      expect(neighbor.width).toBeGreaterThanOrEqual(48);
      expect(neighbor.x - target.x - target.width).toBeCloseTo(2, 1);
      await page.mouse.move(
        target.x + target.width / 2,
        target.y + target.height / 2
      );
      await page.mouse.down();
      try {
        await expect
          .poll(() =>
            action.evaluate((element) => getComputedStyle(element).borderRadius)
          )
          .toBe('8px');
        await expect(action).toHaveAttribute('aria-pressed', 'true');
        expect(await action.boundingBox()).toEqual(target);
        expect(await arrow.boundingBox()).toEqual(neighbor);
        await page.screenshot({
          path: testInfo.outputPath(
            `social-press-${width}-${reducedMotion}.png`
          ),
          fullPage: false,
        });
      } finally {
        await page.mouse.up();
      }
    }
  }
});

test('RSS fallback retains native navigation and a visible keyboard indicator', async ({
  page,
}) => {
  await page.route('**/api/atproto/social*', (route) =>
    route.fulfill({ json: { enabled: false, ready: false, signedIn: false } })
  );
  await page.goto('/writings');
  const fallback = page.getByRole('link', {
    name: 'Subscribe by RSS',
    exact: true,
  });
  await expect(fallback).toHaveAttribute('href', '/writings/feed.xml');
  await page.keyboard.press('Tab');
  await fallback.focus();
  expect(
    await fallback.evaluate((element) => getComputedStyle(element).outlineWidth)
  ).toBe('3px');
  expect((await fallback.boundingBox())!.height).toBeGreaterThanOrEqual(48);
});
