import { expect, test } from '@playwright/test';

test('repeated search parameters use the first query value', async ({
  page,
}) => {
  const response = await page.goto('/search?q=Curfew&q=unused-second-query');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('searchbox', { name: 'Search', exact: true })
  ).toHaveValue('Curfew');
});
