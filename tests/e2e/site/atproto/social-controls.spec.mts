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
  await expect(
    page.getByRole('button', { name: 'Wait a moment', exact: true })
  ).toBeDisabled();
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
