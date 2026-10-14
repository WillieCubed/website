import { expect, test } from '@playwright/test';

// Every project is a draft until Willie clears the flag himself. When he
// publishes one, move its slug out of this list in the same commit.
const DRAFTS = ['parlipro', 'hackportal', 'connie'];

test('draft project pages are not served in production', async ({ page }) => {
  for (const slug of DRAFTS) {
    const response = await page.goto(`/projects/${slug}`);
    expect(response?.status(), slug).toBe(404);
  }
});
