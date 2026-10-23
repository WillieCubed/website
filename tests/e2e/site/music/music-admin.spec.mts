import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

import type {
  MusicCatalog,
  MusicPublication,
} from '../../../../lib/music/types';

test.skip(
  process.env.MUSIC_E2E !== '1',
  'Requires the isolated signed-JWT Music harness.'
);
const ids = ['1', '2', '3'].map((n) => n.repeat(22));

const pollingPublication: MusicPublication = {
  id: 'pending-feedback',
  revisionId: 'reviewed-feedback',
  status: 'publishing',
  error: null,
  createdAt: '2026-10-15T12:00:00.000Z',
};

test('publication polling does not erase a failed history request', async ({
  page,
  request,
}) => {
  const initial = await (await request.get('/api/studio/music/catalog')).json();
  await page.route('**/api/studio/music/catalog', async (route) => {
    await route.fulfill({
      json: {
        ...initial,
        revision: {
          ...initial.revision,
          id: pollingPublication.revisionId,
          createdAt: pollingPublication.createdAt,
          conflict: false,
          body: {
            version: 1,
            order: ids,
            selected: [ids[0]],
            lead: null,
            series: [],
            notes: {},
          },
        },
        publication: pollingPublication,
      },
    });
  });
  await page.route('**/api/studio/music/history', (route) =>
    route.fulfill({
      status: 503,
      json: { error: 'History could not load.' },
    })
  );
  let releasePoll!: () => void;
  const released = new Promise<void>((resolve) => {
    releasePoll = resolve;
  });
  await page.route(
    '**/api/studio/music/publications/pending-feedback',
    async (route) => {
      await released;
      await route.fulfill({ json: { ...pollingPublication, status: 'live' } });
    }
  );
  await page.goto('/studio/music');
  await page
    .getByRole('button', { name: 'Open menu for Music', exact: true })
    .click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  const historyError = page.getByText('History could not load.', {
    exact: true,
  });
  await expect(historyError).toBeVisible();
  releasePoll();
  await expect(
    page.getByText('The collection is live.', { exact: true })
  ).toBeVisible({ timeout: 15000 });
  await expect(historyError).toBeVisible();
});

test('a publication response from before an edit cannot replace failed save feedback', async ({
  page,
  request,
}) => {
  const initial = await (await request.get('/api/studio/music/catalog')).json();
  await page.route('**/api/studio/music/catalog', async (route) => {
    if (route.request().method() === 'PUT') {
      return route.fulfill({
        status: 503,
        json: { error: 'Save needs a retry.' },
      });
    }
    await route.fulfill({
      json: {
        ...initial,
        revision: {
          ...initial.revision,
          id: pollingPublication.revisionId,
          createdAt: pollingPublication.createdAt,
          conflict: false,
          body: {
            version: 1,
            order: ids,
            selected: [ids[0]],
            lead: null,
            series: [],
            notes: {},
          },
        },
        publication: pollingPublication,
      },
    });
  });
  let releasePoll!: () => void;
  let pollStarted!: () => void;
  const released = new Promise<void>((resolve) => {
    releasePoll = resolve;
  });
  const started = new Promise<void>((resolve) => {
    pollStarted = resolve;
  });
  await page.route(
    '**/api/studio/music/publications/pending-feedback',
    async (route) => {
      pollStarted();
      await released;
      await route.fulfill({ json: { ...pollingPublication, status: 'live' } });
    }
  );
  await page.goto('/studio/music');
  await started;
  await page
    .getByRole('checkbox', { name: 'Include An empty collection', exact: true })
    .check();
  const saveError = page.getByText('Save needs a retry.', { exact: true });
  await expect(saveError).toBeVisible();
  const response = page.waitForResponse(
    '**/api/studio/music/publications/pending-feedback'
  );
  releasePoll();
  await response;
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  );
  await expect(saveError).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Retry save', exact: true })
  ).toBeVisible();
  await expect(
    page.getByText('The collection is live.', { exact: true })
  ).toHaveCount(0);
  await expect(page.getByText('Live collection', { exact: true })).toHaveCount(
    0
  );
});

for (const operation of ['refresh', 'publication'] as const) {
  test(`browser recovery waits for ${operation} and saves the recovered editor afterward`, async ({
    page,
    request,
  }) => {
    const initial = await (
      await request.get('/api/studio/music/catalog')
    ).json();
    const catalog: MusicCatalog = {
      version: 1,
      order: ids,
      selected: [ids[1]],
      lead: null,
      series: [],
      notes: {},
    };
    const recovered = { ...catalog, selected: [ids[0]] };
    const revision = {
      id: 'recovery-base',
      body: catalog,
      conflict: false,
      createdAt: '2026-10-16T12:00:00.000Z',
    };
    let saved: MusicCatalog | undefined;
    await page.route('**/api/studio/music/catalog', async (route) => {
      if (route.request().method() === 'PUT') {
        const edit = route.request().postDataJSON();
        expect(edit.expectedRevisionId).toBe('recovery-base');
        saved = edit.catalog;
        await route.fulfill({
          json: {
            revision: { ...revision, id: 'recovered-save', body: saved },
          },
        });
        return;
      }
      await route.fulfill({
        json: { ...initial, revision, publication: null },
      });
    });
    await page.addInitScript((catalog) => {
      localStorage.setItem(
        'willie-music-recovery-v1',
        JSON.stringify({ base: 'previous-tab', catalog })
      );
    }, recovered);
    let release!: () => void;
    let started!: () => void;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const requested = new Promise<void>((resolve) => {
      started = resolve;
    });
    const path = operation === 'refresh' ? 'import' : 'publications';
    await page.route(`**/api/studio/music/${path}`, async (route) => {
      started();
      await released;
      await route.fulfill({
        json:
          operation === 'refresh'
            ? { failed: 0 }
            : {
                ...pollingPublication,
                revisionId: revision.id,
                status: 'live',
              },
      });
    });
    await page.goto('/studio/music');
    const recover = page.getByRole('button', {
      name: 'Recover draft',
      exact: true,
    });
    await expect(recover).toBeEnabled();
    if (operation === 'refresh') {
      await page.getByRole('button', { name: 'Open menu for Music' }).click();
      await page.getByRole('button', { name: 'Refresh Spotify' }).click();
    } else {
      await page
        .getByRole('button', { name: 'Review changes', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Publish collection', exact: true })
        .click();
    }
    await requested;
    try {
      await expect(recover).toBeDisabled();
      await recover.evaluate((button: HTMLButtonElement) => button.click());
      await expect(
        page.getByText('This browser has an unsaved draft.', { exact: true })
      ).toBeVisible();
      expect(saved).toBeUndefined();
      expect(
        await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem('willie-music-recovery-v1')!)
              .catalog.selected
        )
      ).toEqual([ids[0]]);
    } finally {
      release();
    }
    await expect(recover).toBeEnabled();
    await recover.click();
    await expect(recover).toHaveCount(0);
    await expect(
      page.getByRole('checkbox', {
        name: 'Include A long playlist title that preserves the sequence across several evenings',
        exact: true,
      })
    ).toBeChecked();
    await expect(
      page.getByRole('checkbox', {
        name: 'Include Summer in the city',
        exact: true,
      })
    ).not.toBeChecked();
    await expect.poll(() => saved?.selected).toEqual([ids[0]]);
    await expect
      .poll(() =>
        page.evaluate(() => localStorage.getItem('willie-music-recovery-v1'))
      )
      .toBeNull();
    await expect(
      page.getByText('Saved privately', { exact: true }).first()
    ).toBeVisible();
  });
}

test('the public Music gallery loads, passes axe, and fits the viewport', async ({
  page,
}, info) => {
  const response = await page.goto('/music');
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Music', exact: true })
  ).toBeVisible();
  await expect(page.locator('.music')).toHaveAttribute('aria-busy', 'false');
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
  ).toContainText('Importing Spotify playlists…');
  await expect(page.locator('.music')).toHaveAttribute('inert', '');
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
  await page.evaluate(() => document.fonts.ready);
  const review = page.getByRole('button', { name: 'Review changes' });
  await expect(review).toBeEnabled();
  await review.scrollIntoViewIfNeeded();
  // The footer writes its scroll-driven sheet width on the next animation frame.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      )
  );
  const composition = () =>
    page.evaluate(() =>
      Array.from(
        document.querySelectorAll(
          'header[data-column],.music-rail,.music-grid,.music-sample-note,.music-draft-note'
        )
      ).map((element) => {
        const box = element.getBoundingClientRect();
        return {
          x: box.x,
          y: box.y + scrollY,
          width: box.width,
          height: box.height,
        };
      })
    );
  const before = await composition();
  await review.click();
  await page.getByRole('button', { name: 'Publish collection' }).click();
  const notice = page.locator('.music-admin-notice[role="status"]');
  await expect(notice).toContainText('The collection is live.');
  await expect(page.getByText('Live collection')).toBeVisible();
  const bar = await page.locator('header[data-column]').boundingBox();
  const message = await notice.boundingBox();
  expect(bar).not.toBeNull();
  expect(message).not.toBeNull();
  const actions = await page.locator('.music-draft-note').boundingBox();
  // The action surface can now park above the footer while the snackbar
  // stays at the viewport edge. They must remain separate in either position.
  expect(
    message!.y + message!.height < actions!.y ||
      message!.y > actions!.y + actions!.height
  ).toBe(true);
  const footer = await page.locator('.site-footer').boundingBox();
  expect(actions!.y + actions!.height).toBeLessThanOrEqual(footer!.y);
  // Publication feedback must preserve the workspace composition.
  expect(await composition()).toEqual(before);
  await expect(
    page.getByRole('complementary', { name: 'Private preview' })
  ).toHaveCount(0);
  expect(bar!.y).toBeLessThan(message!.y);
  const dir = '.playwright-mcp/music/iterations/2026-10-13-studio-toast';
  await mkdir(dir, { recursive: true });
  await page.evaluate(() => scrollTo(0, 0));
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

test('edits queued during an in-flight save survive the next revision', async ({
  page,
  request,
}) => {
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
  let releaseSave!: () => void;
  const released = new Promise<void>((resolve) => {
    releaseSave = resolve;
  });
  let savedFirst!: () => void;
  const firstSaved = new Promise<void>((resolve) => {
    savedFirst = resolve;
  });
  let writes = 0;
  await page.route('**/api/studio/music/catalog', async (route) => {
    if (route.request().method() !== 'PUT' || ++writes !== 1)
      return route.continue();
    const response = await route.fetch();
    savedFirst();
    await released;
    await route.fulfill({ response });
  });
  await page.goto('/studio/music');
  await page
    .getByRole('checkbox', {
      name: 'Include A long playlist title that preserves the sequence across several evenings',
      exact: true,
    })
    .check();
  try {
    await firstSaved;
    await page
      .getByRole('checkbox', {
        name: 'Include An empty collection',
        exact: true,
      })
      .check();
    await expect(
      page.getByRole('button', { name: 'Review changes', exact: true })
    ).toBeDisabled();
  } finally {
    releaseSave();
  }
  await expect(
    page.getByText('Saved privately', { exact: true }).first()
  ).toBeVisible();
  const saved = await (await request.get('/api/studio/music/catalog')).json();
  expect(saved.revision.body.selected).toEqual([ids[1], ids[0], ids[2]]);
  expect(writes).toBe(2);
  await page.reload();
  await expect(
    page.getByRole('checkbox', {
      name: 'Include An empty collection',
      exact: true,
    })
  ).toBeChecked();
});

test('restoring an older revision reloads the saved collection and curation selection', async ({
  page,
  request,
}) => {
  const initial = await (await request.get('/api/studio/music/catalog')).json();
  const catalog = {
    version: 1,
    order: ids,
    selected: [ids[1]],
    lead: null,
    series: [],
    notes: {},
  };
  const olderResponse = await request.put('/api/studio/music/catalog', {
    headers: { origin: process.env.STUDIO_TEST_ORIGIN! },
    data: { expectedRevisionId: initial.revision?.id ?? null, catalog },
  });
  expect(olderResponse.ok()).toBeTruthy();
  const older = await olderResponse.json();
  const currentResponse = await request.put('/api/studio/music/catalog', {
    headers: { origin: process.env.STUDIO_TEST_ORIGIN! },
    data: {
      expectedRevisionId: older.revision.id,
      catalog: { ...catalog, selected: [ids[1], ids[2]] },
    },
  });
  expect(currentResponse.ok()).toBeTruthy();
  const current = await currentResponse.json();
  await page.goto('/studio/music');
  const emptySelection = page.getByRole('checkbox', {
    name: 'Include An empty collection',
    exact: true,
  });
  await expect(emptySelection).toBeChecked();
  const history = await (await request.get('/api/studio/music/history')).json();
  const targetIndex = history.revisions.findIndex(
    (revision: { id: string }) => revision.id === older.revision.id
  );
  expect(targetIndex).toBeGreaterThanOrEqual(0);
  await page
    .getByRole('button', { name: 'Open menu for Music', exact: true })
    .click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Saved revisions' });
  await expect(dialog).toBeVisible();
  await dialog
    .locator('li')
    .nth(targetIndex)
    .getByRole('button', { name: 'Restore', exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(emptySelection).not.toBeChecked();
  await expect(
    page.getByRole('checkbox', {
      name: 'Include Summer in the city',
      exact: true,
    })
  ).toBeChecked();
  const restored = await (
    await request.get('/api/studio/music/catalog')
  ).json();
  expect(restored.revision.body).toEqual(catalog);
  expect(restored.revision.id).not.toBe(current.revision.id);
  expect(restored.revision.id).not.toBe(older.revision.id);
});
