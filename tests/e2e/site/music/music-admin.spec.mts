import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test.skip(
  process.env.MUSIC_E2E !== '1',
  'Requires the isolated signed-JWT Music harness.'
);
const ids = ['1', '2', '3'].map((n) => n.repeat(22));

test('the public Music gallery loads, passes axe, and fits the viewport', async ({
  page,
}, info) => {
  const response = await page.goto('/music');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Music', exact: true })
  ).toBeVisible();
  await expect(page.locator('.music-prototype')).toHaveAttribute(
    'aria-busy',
    'false'
  );
  await page.evaluate(() => document.fonts.ready);
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      targets: nodes.map((node) => node.target),
    }))
  ).toEqual([]);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  ).toBe(false);
  await page.screenshot({
    path: info.outputPath('public-music.png'),
    fullPage: false,
  });
});
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
test('a Spotify refresh keeps the reviewed draft aligned with the saved revision', async ({
  page,
  request,
}, info) => {
  const initial = await (await request.get('/api/studio/music/catalog')).json();
  const reset = await request.put('/api/studio/music/catalog', {
    headers: { origin: process.env.STUDIO_TEST_ORIGIN! },
    data: {
      expectedRevisionId: initial.revision?.id ?? null,
      catalog: {
        version: 1,
        order: ids,
        selected: [ids[1]],
        lead: null,
        series: [],
        notes: {},
      },
    },
  });
  expect(reset.ok()).toBeTruthy();
  let finishImport!: () => void;
  const importFinished = new Promise<void>((resolve) => {
    finishImport = resolve;
  });
  let importStarted!: () => void;
  const importRequested = new Promise<void>((resolve) => {
    importStarted = resolve;
  });
  await page.route('**/api/studio/music/import', async (route) => {
    importStarted();
    await importFinished;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ failed: 0 }),
    });
  });
  await page.goto('/studio/music');
  const selection = page.getByRole('checkbox', {
    name: 'Include Summer in the city',
    exact: true,
  });
  await expect(selection).toBeChecked();
  await page.getByRole('button', { name: 'Open menu for Music' }).click();
  await page.getByRole('button', { name: 'Refresh Spotify' }).click();
  await importRequested;
  await expect(
    page.locator('.music-admin-notices [role="status"]')
  ).toContainText('Importing your Spotify playlists…');
  await expect(page.locator('.music-prototype')).toHaveAttribute('inert', '');
  await expect(selection).toBeDisabled();
  const dir = '.playwright-mcp/music/iterations/2026-10-13-refresh-locked';
  await mkdir(dir, { recursive: true });
  await page.screenshot({
    path: `${dir}/${info.project.name}-refresh.png`,
    fullPage: false,
  });
  finishImport();
  await expect(
    page.getByText('Saved privately', { exact: true }).first()
  ).toBeVisible();
  await expect(selection).toBeChecked();
  await page.screenshot({
    path: `${dir}/${info.project.name}-ready.png`,
    fullPage: false,
  });
  const saved = await (await request.get('/api/studio/music/catalog')).json();
  expect(saved.revision.body.selected).toEqual([ids[1]]);
});
test('publication feedback stays out of the page layout', async ({
  page,
  request,
}, info) => {
  const initial = await (await request.get('/api/studio/music/catalog')).json();
  const savedResponse = await request.put('/api/studio/music/catalog', {
    headers: { origin: process.env.STUDIO_TEST_ORIGIN! },
    data: {
      expectedRevisionId: initial.revision?.id ?? null,
      catalog: {
        version: 1,
        order: ids,
        selected: [ids[0]],
        lead: null,
        series: [],
        notes: {},
      },
    },
  });
  expect(savedResponse.ok()).toBeTruthy();
  const { revision } = await savedResponse.json();
  await page.route('**/api/studio/music/publications', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'visual-publication',
        revisionId: revision.id,
        status: 'live',
        error: null,
        createdAt: new Date().toISOString(),
      }),
    });
  });
  await page.goto('/studio/music');
  await page.getByRole('button', { name: 'Review changes' }).click();
  await page.getByRole('button', { name: 'Publish collection' }).click();
  const notice = page.locator('.music-admin-notice[role="status"]');
  await expect(notice).toContainText('Your collection is live.');
  await expect(page.getByText('Live collection')).toBeVisible();
  const bar = await page.locator('header[data-column]').boundingBox();
  const message = await notice.boundingBox();
  expect(bar).not.toBeNull();
  expect(message).not.toBeNull();
  expect(bar!.y).toBe(0);
  await expect(
    page.getByRole('complementary', { name: 'Private preview' })
  ).toHaveCount(0);
  expect(bar!.y).toBeLessThan(message!.y);
  const dir = '.playwright-mcp/music/iterations/2026-10-13-studio-toast';
  await mkdir(dir, { recursive: true });
  await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
  await page.screenshot({
    path: `${dir}/${info.project.name}.png`,
    fullPage: false,
  });
  await page
    .getByRole('button', { name: 'Dismiss publication message' })
    .click();
  await expect(notice).toHaveCount(0);
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
