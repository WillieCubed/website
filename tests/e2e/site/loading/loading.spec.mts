import { expect, test } from '@playwright/test';

const id = '1'.repeat(22);
const catalog = {
  version: 1,
  order: [id],
  selected: [id],
  lead: null,
  series: [],
  notes: {},
};
const playlist = {
  id,
  title: 'Loading audit fixture',
  description: '',
  image: null,
  url: `https://open.spotify.com/playlist/${id}`,
  ownerId: 'fixture',
  eligible: true,
  snapshot: 'fixture',
  tracks: [],
  trackCount: 0,
  checkedAt: new Date().toISOString(),
  error: null,
};

test('Music curation retains its gallery shell while the collection arrives', async ({
  page,
}, info) => {
  test.skip(
    !process.env.STUDIO_TEST_TOKEN,
    'Requires the isolated signed Access fixture.'
  );
  await page.setExtraHTTPHeaders({
    'cf-access-jwt-assertion': process.env.STUDIO_TEST_TOKEN!,
  });
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/studio/music/catalog', async (route) => {
    await held;
    await route.fulfill({
      json: {
        revision: { id: 'fixture', body: catalog },
        playlists: [playlist],
      },
    });
  });
  await page.route('**/api/studio/music/connection', (route) =>
    route.fulfill({ json: { connected: true } })
  );
  await page.goto('/studio/music');
  await expect(page.locator('.mp-rail h1')).toHaveText('Music');
  await expect(page.locator('.mp-collection')).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Library filter' })
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: info.outputPath('music-pending.png'),
    fullPage: false,
  });
  const heading = page.locator('.mp-rail h1');
  const before = await heading.boundingBox();
  const pendingCard = await page.locator('.mp-card').first().boundingBox();
  await heading.evaluate((node) => {
    (window as Window & { __musicHeading?: Element }).__musicHeading = node;
  });
  release();
  await expect(
    page.getByRole('link', {
      name: 'Open Loading audit fixture',
      exact: true,
    })
  ).toBeVisible();
  expect(
    await heading.evaluate(
      (node) =>
        node ===
        (window as Window & { __musicHeading?: Element }).__musicHeading
    )
  ).toBe(true);
  expect(await heading.boundingBox()).toEqual(before);
  expect(await page.locator('.mp-card').first().boundingBox()).toEqual(
    pendingCard
  );
  await page.screenshot({
    path: info.outputPath('music-loaded.png'),
    fullPage: false,
  });
});

test('search results and truthful home values are visible without scripting', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/search?q=transit');
  await expect(page.locator('input[name=q]')).toHaveValue('transit');
  await expect(
    page.getByRole('heading', { name: 'TransitMapper', exact: true })
  ).toBeVisible();
  await page.goto('/');
  await expect(page.locator('.count').first()).not.toContainText('…');
  await context.close();
});

test('instant search distinguishes pending from empty and offers native recovery', async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    process.env.STUDIO_TEST_TOKEN
      ? '**/api/search?*'
      : '**/pagefind/pagefind.js',
    async (route) => {
      await held;
      await route.abort();
    }
  );
  await page.goto('/search');
  await expect(page.locator('.palette-trigger__key').first()).not.toBeEmpty();
  await page.keyboard.press('Meta+k');
  const input = page.getByRole('combobox', {
    name: 'Search the site or type a command',
  });
  await input.fill('transit');
  await expect(page.locator('.palette-empty')).not.toContainText(
    'Nothing on the site'
  );
  await expect(
    page.getByRole('status').filter({ hasText: 'Searching' })
  ).toBeVisible();
  release();
  await expect(
    page.getByRole('link', { name: 'Search without instant search' })
  ).toHaveAttribute('href', '/search?q=transit');
  await expect(page.locator('.palette-body')).not.toContainText('pagefind.js');
});

test('instant search never opens a result from the previous query', async ({
  page,
}) => {
  await page.goto('/search');
  await expect(page.locator('.palette-trigger__key').first()).not.toBeEmpty();
  await page.keyboard.press('Meta+k');
  const input = page.getByRole('combobox', {
    name: 'Search the site or type a command',
  });
  await input.fill('transit');
  await expect(
    page.getByRole('option').filter({ hasText: 'TransitMapper' })
  ).toBeVisible();
  await input.fill('zzzz-no-matches');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/search$/);
  await expect(input).toBeFocused();
});

test('Music curation keeps its shell through a failed load and retry', async ({
  page,
}) => {
  test.skip(
    !process.env.STUDIO_TEST_TOKEN,
    'Requires the isolated signed Access fixture.'
  );
  let failed = true;
  await page.route('**/api/studio/music/catalog', (route) =>
    route.fulfill(
      failed
        ? { status: 503, json: { error: 'Collection unavailable.' } }
        : {
            json: {
              revision: { id: 'fixture', body: catalog },
              playlists: [playlist],
            },
          }
    )
  );
  await page.route('**/api/studio/music/connection', (route) =>
    route.fulfill({ json: { connected: true } })
  );
  await page.goto('/studio/music');
  const heading = page.locator('.mp-rail h1');
  await expect(heading).toHaveText('Music');
  await expect(
    page.getByRole('button', { name: 'Try again', exact: true })
  ).toBeVisible();
  await expect(page.locator('.music-experience')).toHaveAttribute(
    'aria-busy',
    'false'
  );
  await heading.evaluate((node) =>
    Object.assign(window, { __musicHeading: node })
  );
  failed = false;
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(
    page.getByRole('link', { name: 'Open Loading audit fixture', exact: true })
  ).toBeVisible();
  expect(
    await heading.evaluate(
      (node) =>
        node ===
        (window as Window & { __musicHeading?: Element }).__musicHeading
    )
  ).toBe(true);
});

test('Studio keeps its navigation and library composition while writings load', async ({
  page,
}, info) => {
  test.skip(
    !process.env.STUDIO_TEST_TOKEN,
    'Requires the isolated signed Access fixture.'
  );
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/studio/documents', async (route) => {
    await held;
    await route.fulfill({ json: { documents: [] } });
  });
  await page.goto('/studio');
  await expect(
    page.getByRole('heading', { name: 'Your writings', exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Your writings', exact: true })
  ).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: info.outputPath('studio-pending.png'),
    fullPage: false,
  });
  const before = await page
    .getByRole('heading', { name: 'Your writings', exact: true })
    .boundingBox();
  release();
  await expect(
    page.getByRole('region', { name: 'Your writings', exact: true })
  ).toHaveAttribute('aria-busy', 'false');
  expect(
    await page
      .getByRole('heading', { name: 'Your writings', exact: true })
      .boundingBox()
  ).toEqual(before);
  await page.screenshot({
    path: info.outputPath('studio-empty.png'),
    fullPage: false,
  });
});

test('home detail destinations are readable and closable without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/?detail=lvbt');
  await expect(page.locator('dialog.detail')).toBeVisible();
  await expect(page.locator('dialog.detail h2')).toContainText(
    'Las Vegans for Better Transit'
  );
  await page
    .locator('dialog.detail')
    .getByRole('link', { name: 'Close', exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('dialog.detail')).toBeHidden();
  await context.close();
});

test('social actions retain their slot through busy, confirmed, and undo states', async ({
  page,
}, info) => {
  test.skip(
    !process.env.STANDARD_SOCIAL_FIXTURE,
    'Requires the isolated social fixture build.'
  );
  await page.route('**/api/atproto/social*', (route) =>
    route.fulfill({
      json: { enabled: true, ready: true, signedIn: true, subscribed: false },
    })
  );
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/atproto/subscription', async (route) => {
    await held;
    await route.fulfill({
      json: { active: route.request().method() === 'PUT' },
    });
  });
  await page.goto('/writings');
  const root = page.locator('[data-standard-social=subscription]');
  const before = await root.boundingBox();
  await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
  const busy = page.getByRole('button', { name: 'Subscribing…', exact: true });
  await expect(busy).toHaveAttribute('aria-busy', 'true');
  expect(await root.boundingBox()).toEqual(before);
  expect(
    await busy
      .locator('svg')
      .evaluate((node) => node.getBoundingClientRect().width)
  ).toBe(24);
  await page.screenshot({
    path: info.outputPath('social-pending.png'),
    fullPage: false,
  });
  release();
  await expect(
    page.getByRole('button', { name: 'Subscribed', exact: true })
  ).toBeVisible();
  expect(await root.boundingBox()).toEqual(before);
  await page.getByRole('button', { name: 'Subscribed', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Subscribe', exact: true })
  ).toBeVisible();
  await expect(root.getByRole('status')).toContainText('Unsubscribed.');
  expect(await root.boundingBox()).toEqual(before);
});

test('a callback failure stays visible when social actions become unavailable', async ({
  page,
}) => {
  test.skip(
    !process.env.STANDARD_SOCIAL_FIXTURE,
    'Requires the isolated social fixture build.'
  );
  await page.route('**/api/atproto/social*', (route) =>
    route.fulfill({ json: { enabled: true, ready: false, signedIn: false } })
  );
  await page.goto('/writings?atprotoError=cancelled');
  await expect(
    page.locator('[data-standard-social]').getByRole('alert')
  ).toContainText('Subscriptions are unavailable right now.');
  await expect(
    page.getByRole('link', { name: 'Subscribe by RSS', exact: true })
  ).toHaveAttribute('href', '/writings/feed.xml');
  await expect(page).toHaveURL(/\/writings$/);
});

test('enhanced navigation acknowledges a held route while preserving the current page', async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    (url) => url.pathname === '/projects' && url.searchParams.has('_rsc'),
    async (route) => {
      await held;
      await route.continue();
    }
  );
  await page.goto('/media');
  await page.locator('.site-footer__pages a[href="/projects"]').click();
  await expect(
    page.locator('.site-navigation-hint[data-pending]')
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Media', exact: true })
  ).toBeVisible();
  release();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.locator('.site-navigation-hint[data-pending]')).toHaveCount(
    0
  );
});

test('private project media reserves its actual dimensions before decoding', async ({
  page,
}) => {
  test.skip(
    !process.env.STUDIO_TEST_TOKEN,
    'Requires the isolated signed Access fixture.'
  );
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    '**/assets/projects/parlipro/feature-companion-view.png',
    async (route) => {
      await held;
      await route.continue();
    }
  );
  await page.goto('/projects/parlipro', { waitUntil: 'domcontentloaded' });
  const image = page
    .locator('img[src="/assets/projects/parlipro/feature-companion-view.png"]')
    .last();
  await expect(image).toBeVisible();
  const before = await image.boundingBox();
  expect(before!.height).toBeGreaterThan(100);
  release();
  await expect
    .poll(() => image.evaluate((node) => (node as HTMLImageElement).complete))
    .toBe(true);
  expect(await image.boundingBox()).toEqual(before);
});

test('private Spotify imports retain a portable track destination', async ({
  page,
}) => {
  test.skip(
    !process.env.STUDIO_TEST_TOKEN,
    'Requires the isolated signed Access fixture.'
  );
  await page.route('https://open.spotify.com/embed/**', (route) =>
    route.abort()
  );
  await page.goto('/writings/project-superbloom');
  await expect(
    page.getByRole('link', { name: 'Listen on Spotify', exact: true })
  ).toHaveAttribute(
    'href',
    /open\.spotify\.com\/track\/2HvtedoEeymVWrBPyAMNwZ/
  );
  const frame = page.getByTitle('Spotify track');
  await expect(frame).toHaveCount(0);
});

test('public Music has usable playlist destinations without scripting', async ({
  browser,
  baseURL,
}) => {
  test.skip(
    !process.env.STUDIO_TEST_TOKEN,
    'Requires the isolated approved Music cache and signed Access fixture.'
  );
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
    extraHTTPHeaders: {
      'cf-access-jwt-assertion': process.env.STUDIO_TEST_TOKEN!,
    },
  });
  const page = await context.newPage();
  await page.goto('/music');
  await expect(page.locator('.music-experience')).toHaveAttribute(
    'aria-busy',
    'false'
  );
  const card = page.locator('.mp-card-open').first();
  await expect(card).toHaveAttribute('href', /detail=/);
  await card.click();
  await expect(page.locator('dialog.mp-detail')).toBeVisible();
  await expect(page.locator('#mp-detail-title')).not.toBeEmpty();
  await page.getByRole('link', { name: 'Close playlist', exact: true }).click();
  await expect(page.locator('dialog.mp-detail')).toBeHidden();
  await context.close();
});
