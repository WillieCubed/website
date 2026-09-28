import { expect, test } from '@playwright/test';

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
