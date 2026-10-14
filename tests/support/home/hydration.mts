import type { Page } from '@playwright/test';

/** The streamed detail copy must leave before assertions target the hydrated dialog. */
export async function waitForHomeDetailHydration(page: Page) {
  await page.waitForFunction(() => {
    const cover = document.querySelector('#lvbt a.cover');
    return (
      !!cover &&
      Object.keys(cover).some((key) => key.startsWith('__react')) &&
      document.querySelectorAll('dialog.detail').length === 1 &&
      !!document.querySelector('.home > dialog.detail')
    );
  });
}
