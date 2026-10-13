import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test.skip(
  process.env.MUSIC_E2E !== '1',
  'Requires the isolated signed-JWT Music harness.'
);
const ids = ['1', '2', '3'].map((n) => n.repeat(22));
test('owner can choose a feature, save, reopen and recover a conflict without publishing', async ({
  page,
  request,
}, info) => {
  const initial = await (await request.get('/api/studio/music/catalog')).json();
  await request.put('/api/studio/music/catalog', {
    headers: { origin: process.env.STUDIO_TEST_ORIGIN! },
    data: {
      expectedRevisionId: initial.revision?.id ?? null,
      catalog: {
        version: 1,
        order: ids,
        selected: [],
        lead: null,
        series: [],
        notes: {},
      },
    },
  });
  await page.goto('/studio/music');
  await page
    .getByRole('checkbox', { name: 'Select Summer in the city', exact: true })
    .check();
  await page
    .getByRole('checkbox', {
      name: 'Select A long playlist title that preserves the sequence across several evenings',
      exact: true,
    })
    .check();
  await page
    .getByRole('button', { name: 'Preview collection', exact: true })
    .click();
  await page
    .getByRole('radio', { name: 'Feature Summer in the city', exact: true })
    .check();
  await page
    .getByRole('radio', { name: 'No featured playlist', exact: true })
    .check();
  await page
    .getByRole('radio', { name: 'Feature Summer in the city', exact: true })
    .check();
  const dir = '.playwright-mcp/music/iterations/2026-10-13-admin-services';
  await mkdir(dir, { recursive: true });
  await page.evaluate(() => scrollTo(0, 0));
  await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
  await page.screenshot({
    path: `${dir}/${info.project.name}-setup.png`,
    fullPage: false,
  });
  await page.screenshot({
    path: `${dir}/${info.project.name}-setup-full.png`,
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Continue to curation', exact: true })
    .click();
  await expect(
    page.getByText('Saved privately', { exact: true }).first()
  ).toBeVisible();
  const saved = await (await request.get('/api/studio/music/catalog')).json();
  expect(saved.revision.body.lead).toBe(ids[1]);
  expect(saved.revision.body.selected).toHaveLength(2);
  await page.reload();
  await expect(
    page.getByRole('checkbox', {
      name: 'Include Summer in the city',
      exact: true,
    })
  ).toBeChecked();
  await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
  await page.screenshot({
    path: `${dir}/${info.project.name}-library.png`,
    fullPage: false,
  });
  await page
    .getByRole('button', { name: 'Open menu for Music', exact: true })
    .click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Saved revisions' })
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('dialog', { name: 'Saved revisions' })
  ).toHaveCount(0);
  const next = await request.put('/api/studio/music/catalog', {
    headers: { origin: process.env.STUDIO_TEST_ORIGIN! },
    data: {
      expectedRevisionId: saved.revision.id,
      catalog: { ...saved.revision.body, notes: { [ids[1]]: 'Other tab' } },
    },
  });
  expect(next.ok()).toBeTruthy();
  await page
    .getByRole('checkbox', { name: 'Include An empty collection', exact: true })
    .check();
  await expect(
    page.locator('.music-admin-notices').getByRole('alert')
  ).toContainText('Both versions are in history');
  await expect(
    page.getByRole('button', { name: 'Review changes', exact: true })
  ).toBeDisabled();
  expect(
    (await (await request.get('/api/studio/music/catalog')).json()).revision
      .body.notes[ids[1]]
  ).toBe('Other tab');
  await page
    .getByRole('button', { name: 'Save my version', exact: true })
    .click();
  await expect(
    page.getByText('Saved privately', { exact: true }).first()
  ).toBeVisible();
  expect(
    (await (await request.get('/api/studio/music/catalog')).json()).revision
      .body.selected
  ).toHaveLength(3);
});
test('anonymous access and foreign-origin changes fail', async ({
  playwright,
  request,
}) => {
  const anonymous = await playwright.request.newContext({
    baseURL: process.env.STUDIO_TEST_ORIGIN,
    extraHTTPHeaders: {},
  });
  expect((await anonymous.get('/api/studio/music/catalog')).status()).toBe(401);
  await anonymous.dispose();
  expect(
    (
      await request.put('/api/studio/music/catalog', {
        headers: { origin: 'https://foreign.invalid' },
        data: {},
      })
    ).status()
  ).toBe(403);
});
