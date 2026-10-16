import { expect, test } from '@playwright/test';

test('a registry response after hover ends cannot reopen a preview', async ({
  page,
}) => {
  let releaseRegistry!: () => void;
  const registryReady = new Promise<void>((resolve) => {
    releaseRegistry = resolve;
  });
  await page.route('**/entities.json', async (route) => {
    await registryReady;
    await route.continue();
  });
  await page.goto('/');
  const link = page.locator('.p-note').getByRole('link', {
    name: 'Las Vegans for Better Transit',
  });
  const requested = page.waitForRequest('**/entities.json');
  await link.hover();
  await requested;
  await page.mouse.move(0, 0);
  const responded = page.waitForResponse('**/entities.json');
  releaseRegistry();
  await (await responded).finished();
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  await expect(page.locator('.link-preview:popover-open')).toHaveCount(0);
  await link.hover();
  await expect(page.locator('.link-preview:popover-open')).toContainText(
    'Las Vegans for Better Transit'
  );
});

test('a headline venture shows its card on hover and on keyboard focus', async ({
  page,
}) => {
  await page.goto('/');
  const link = page
    .locator('.p-note')
    .getByRole('link', { name: 'Las Vegans for Better Transit' });
  const card = page.locator('.link-preview:popover-open');

  await link.hover();
  await expect(card).toContainText('Las Vegans for Better Transit');

  await page.mouse.move(0, 0);
  await expect(card).toHaveCount(0);

  await page.keyboard.press('Tab');
  await link.focus();
  await expect(card).toContainText('Las Vegans for Better Transit');
  await page.keyboard.press('Escape');
  await expect(card).toHaveCount(0);
});
