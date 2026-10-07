import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const directory = '.playwright-mcp';
test('Standard.site sign-in, confirmed actions, undo, failures and mobile layout', async ({
  page,
}) => {
  test.skip(
    !process.env.STANDARD_SOCIAL_FIXTURE,
    'Requires the isolated fixture build documented in docs/atproto.md.'
  );
  mkdirSync(directory, { recursive: true });
  let signedIn = false,
    subscribed = false,
    recommended = false,
    failing = false;
  await page.route('**/api/atproto/social*', (route) =>
    route.fulfill({
      json: { enabled: true, ready: true, signedIn, subscribed, recommended },
    })
  );
  await page.route('**/api/atproto/subscription', (route) => {
    if (failing)
      return route.fulfill({
        status: 502,
        json: {
          error:
            'The account provider could not complete this action. Try again.',
        },
      });
    subscribed = route.request().method() === 'PUT';
    return route.fulfill({ json: { active: subscribed } });
  });
  await page.route('**/api/atproto/recommendation', (route) => {
    recommended = route.request().method() === 'PUT';
    return route.fulfill({ json: { active: recommended } });
  });
  await page.route('**/api/atproto/login', (route) =>
    route.fulfill({
      status: 400,
      json: { error: 'Enter your account handle.' },
    })
  );
  await page.route('**/api/atproto/logout', (route) => {
    signedIn = false;
    return route.fulfill({ json: { signedIn: false } });
  });
  await page.goto('/writings');
  await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
  await expect(page.getByLabel('Your handle')).toBeVisible();
  await page.screenshot({
    path: directory + '/standard-desktop-signin.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: directory + '/standard-mobile-signin.png',
    fullPage: true,
  });
  await page.getByLabel('Your handle').fill('reader.bsky.social');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(
    page.locator('[data-standard-social] [role=alert]')
  ).toContainText('Enter your account handle.');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  signedIn = true;
  await page.reload();
  await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Subscribed', exact: true })
  ).toBeVisible();
  await page.screenshot({
    path: directory + '/standard-mobile-subscribed.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: directory + '/standard-desktop-subscribed.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Subscribed', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Subscribe', exact: true })
  ).toHaveAttribute('aria-pressed', 'false');
  failing = true;
  await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
  await expect(
    page.locator('[data-standard-social] [role=alert]')
  ).toContainText('could not complete');
  await expect(
    page.getByRole('button', { name: 'Subscribe', exact: true })
  ).toHaveAttribute('aria-pressed', 'false');
  await page.goto('/writings/indieweb-acceptance');
  await page.getByRole('button', { name: 'Recommend', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Recommended', exact: true })
  ).toBeVisible();
  await page.screenshot({
    path: directory + '/standard-desktop-recommended.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: directory + '/standard-mobile-recommended.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Recommended', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Recommend', exact: true })
  ).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true })
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Recommend', exact: true }).click();
  await expect(page.getByLabel('Your handle')).toBeVisible();
  await page.screenshot({
    path: directory + '/standard-mobile-recommend-signin.png',
    fullPage: true,
  });
});
