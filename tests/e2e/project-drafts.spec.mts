import { expect, test } from '@playwright/test';

const base = process.env.DRAFTS_BASE_URL;
test.skip(
  !base,
  'Drafts render only on the dev server; set DRAFTS_BASE_URL to run.'
);
test.use({ baseURL: base });

test('ParliPro shows its facts, links, and full write-up', async ({ page }) => {
  await page.goto('/projects/parlipro');
  await expect(
    page.getByRole('heading', { level: 1, name: 'ParliPro' })
  ).toBeVisible();
  await expect(
    page.getByText(
      'Presiding over meetings with parlimentary procedure, done simply.'
    )
  ).toBeVisible();
  await expect(page.getByText('Unreleased')).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'ParliPro Web App' })
  ).toBeVisible();
  await expect(page.getByText('kept having nightmares (/s)')).toBeVisible();
});

test('a project without a write-up shows only its facts', async ({ page }) => {
  await page.goto('/projects/hackportal');
  await expect(
    page.getByRole('heading', { level: 1, name: 'HackPortal' })
  ).toBeVisible();
  await expect(
    page.getByText('Association for Computing Machinery at UT Dallas')
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Project Repository' })
  ).toBeVisible();
});

test('an unknown project is a 404', async ({ page }) => {
  const response = await page.goto('/projects/not-a-project');
  expect(response?.status()).toBe(404);
});
