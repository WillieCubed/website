import AxeBuilder from '@axe-core/playwright';
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
  let holdLogin = false;
  let releaseLogin: (() => void) | undefined;
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
  await page.route('**/api/atproto/login', async (route) => {
    if (holdLogin) {
      await new Promise<void>((resolve) => {
        releaseLogin = resolve;
      });
      await route
        .fulfill({ json: { url: 'https://provider.example/authorize' } })
        .catch(() => undefined);
      return;
    }
    await route.fulfill({
      status: 400,
      json: { error: 'Enter your account handle.' },
    });
  });
  await page.route('**/api/atproto/logout', (route) => {
    signedIn = false;
    return route.fulfill({ json: { signedIn: false } });
  });
  await page.goto('/writings');
  const subscribeAction = page.getByRole('button', {
    name: 'Subscribe',
    exact: true,
  });
  expect(
    await subscribeAction.evaluate(
      (button) => getComputedStyle(button).backgroundColor
    )
  ).not.toBe('rgba(0, 0, 0, 0)');
  await subscribeAction.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/AT Protocol|Bluesky/)).toHaveCount(0);
  expect(
    await page
      .getByRole('button', { name: 'Cancel', exact: true })
      .evaluate((button) => getComputedStyle(button).backgroundColor)
  ).not.toBe('rgba(0, 0, 0, 0)');
  await expect(page.getByLabel('Your handle')).toBeFocused();
  await expect(
    page.getByRole('button', { name: 'Subscribe', exact: true })
  ).toHaveAttribute('aria-haspopup', 'dialog');
  const accessibility = await new AxeBuilder({ page })
    .include('dialog[open]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Subscribe', exact: true })
  ).toBeFocused();
  await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
  await page.screenshot({
    path: directory + '/standard-desktop-signin.png',
    fullPage: false,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const heading = await page
    .getByRole('heading', { name: 'Writings', exact: true })
    .boundingBox();
  const subscribe = await page
    .getByRole('button', { name: 'Subscribe', exact: true })
    .boundingBox();
  expect(
    Math.abs(
      heading!.y + heading!.height / 2 - subscribe!.y - subscribe!.height / 2
    )
  ).toBeLessThan(4);
  await page.screenshot({
    path: directory + '/standard-mobile-signin.png',
    fullPage: false,
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
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
  await page.mouse.click(8, 8);
  await expect(dialog).not.toBeVisible();
  holdLogin = true;
  await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
  await page.getByLabel('Your handle').fill('reader.bsky.social');
  const pendingLogin = page.waitForRequest('**/api/atproto/login');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await pendingLogin;
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  releaseLogin!();
  await page.waitForTimeout(100);
  await expect(page).toHaveURL(/\/writings$/);
  await expect(dialog).not.toBeVisible();
  holdLogin = false;
  signedIn = true;
  await page.reload();
  await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Subscribed', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true })
  ).toBeVisible();
  expect(
    await page
      .getByRole('button', { name: 'Sign out', exact: true })
      .evaluate((button) => getComputedStyle(button).backgroundColor)
  ).not.toBe('rgba(0, 0, 0, 0)');
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
  await page.goto('/writings/tags/indieweb');
  await expect(
    page.getByRole('button', { name: 'Subscribe', exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Subscribed', exact: true })
  ).toHaveCount(0);
  await page.goto('/writings/indieweb-acceptance');
  await expect(
    page.locator('head link[rel="site.standard.document"]')
  ).toHaveAttribute(
    'href',
    /^at:\/\/did:plc:aaaaaaaaaaaaaaaaaaaaaaaa\/site\.standard\.document\//
  );
  const recommendAction = page.getByRole('button', {
    name: 'Recommend',
    exact: true,
  });
  expect(
    await recommendAction.evaluate(
      (button) => getComputedStyle(button).backgroundColor
    )
  ).not.toBe('rgba(0, 0, 0, 0)');
  await expect(
    page.getByRole('button', { name: 'Account options', exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true })
  ).toHaveCount(0);
  await recommendAction.click();
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
  await page.goto('/writings');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Sign out', exact: true })
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Subscribe', exact: true })
  ).toBeFocused();
  await page.goto('/writings/indieweb-acceptance');
  await page.getByRole('button', { name: 'Recommend', exact: true }).click();
  await expect(page.getByLabel('Your handle')).toBeVisible();
  await page.screenshot({
    path: directory + '/standard-mobile-recommend-signin.png',
    fullPage: false,
  });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await expect(dialog).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include('dialog[open]').analyze())
      .violations
  ).toEqual([]);
  await page.screenshot({
    path: directory + '/standard-mobile-signin-dark.png',
    fullPage: false,
  });
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Recommend', exact: true })
  ).toBeFocused();
});
