import AxeBuilder from '@axe-core/playwright';
import { type Locator, expect, test } from '@playwright/test';

test.skip(!process.env.STUDIO_TEST_TOKEN, 'Uses the signed Access fixture.');

const id = '1'.repeat(22);
const playlist = {
  id,
  title: 'Evenings on the way home',
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
const catalog = {
  version: 1,
  order: [id],
  selected: [id],
  lead: null,
  series: [
    {
      id: 'evenings',
      title: 'Long evenings and the journeys between them',
      playlistIds: [id],
    },
    { id: 'summer', title: 'Summer in the city and beyond', playlistIds: [id] },
  ],
  notes: {},
};

async function assertPublicationBarLeavesTargetsClear(targets: Locator[]) {
  // Native focus scrolling and hit testing must keep visible targets reachable.
  for (const target of targets) {
    if (!(await target.isVisible())) continue;

    await target.focus();
    await expect
      .poll(() =>
        target.evaluate((node) => {
          const box = node.getBoundingClientRect();
          const surface = document
            .querySelector('.mp-draft-note')!
            .getBoundingClientRect();
          const hit = document.elementFromPoint(
            box.x + box.width / 2,
            box.y + box.height / 2
          );
          return (
            box.y >= 0 &&
            (box.bottom <= surface.top - 15 ||
              box.top >= surface.bottom + 15) &&
            Boolean(hit && (hit === node || node.contains(hit)))
          );
        })
      )
      .toBe(true);
  }
}

test('public music introduces Willie and retains a native destination without scripts', async ({
  browser,
  page,
}, info) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: page.viewportSize()!,
    colorScheme: info.project.use.colorScheme,
    baseURL: process.env.STUDIO_TEST_ORIGIN,
    extraHTTPHeaders: {
      'cf-access-jwt-assertion': process.env.STUDIO_TEST_TOKEN || '',
    },
  });
  const native = await context.newPage();
  await native.goto('/music');
  await expect(
    native.getByRole('heading', { name: 'Music', exact: true })
  ).toBeVisible();
  await expect(native.locator('main')).not.toContainText(
    /your (collection|gallery|library|playlists)/i
  );
  await expect(native.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Willie Chalmers III’s taste in music, collected in playlists and series.'
  );
  await expect(native.locator('.mp-card-open').first()).toHaveAttribute(
    'href',
    /^\/music\?detail=[A-Za-z0-9]{22}$/
  );
  await expect(native.locator('.mp-card').first()).toBeVisible();
  await native.screenshot({
    path: info.outputPath('music-public-no-script.png'),
    fullPage: false,
  });
  await context.close();
});

test('curation prioritizes playlists and keeps the same composition through loading', async ({
  page,
}, info) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/studio/music/catalog', async (route) => {
    await held;
    await route.fulfill({
      json: {
        revision: { id: 'fixture', body: { ...catalog, series: [] } },
        playlists: [playlist],
      },
    });
  });
  await page.route('**/api/studio/music/connection', (route) =>
    route.fulfill({ json: { connected: true } })
  );
  await page.goto('/studio/music');
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
  const create = page.getByRole('button', {
    name: 'Create a series',
    includeHidden: true,
  });
  await expect(create).toBeDisabled();
  const filters = page.locator('.mp-library-filters');
  for (const button of await filters
    .getByRole('button', { includeHidden: true })
    .all())
    await expect(button).toBeDisabled();
  await expect(page.locator('.mp-collection-header')).not.toContainText('—');
  const pending = await page.locator('.mp-card').first().boundingBox();
  await page.screenshot({
    path: info.outputPath('music-pending.png'),
    fullPage: false,
  });
  release();
  await expect(
    page.getByRole('link', { name: `Open ${playlist.title}`, exact: true })
  ).toBeVisible();
  await expect(create).toBeEnabled();
  await expect(page.locator('.mp-shell')).not.toContainText(/\byour\b/i);
  await expect(page.locator('.mp-series-nav')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Reorder playlists', exact: true })
  ).toBeDisabled();
  const creationStyle = await create.evaluate((button) => {
    const css = getComputedStyle(button);
    return {
      background: css.backgroundColor,
      radius: parseFloat(css.borderRadius),
      height: button.getBoundingClientRect().height,
    };
  });
  expect(creationStyle.background).not.toBe('rgba(0, 0, 0, 0)');
  expect(creationStyle.radius).toBeGreaterThanOrEqual(24);
  expect(creationStyle.height).toBeGreaterThanOrEqual(44);

  await expect(page.locator('.mp-collection-header')).toContainText(
    '1 playlist'
  );
  await expect(page.locator('.mp-collection-header')).not.toContainText(
    '1 playlists'
  );
  await expect(
    page.getByRole('button', { name: /Move .* (earlier|later)/ })
  ).toHaveCount(0);
  const card = await page.locator('.mp-card').first().boundingBox();
  expect(card).toEqual(pending);
  if (info.project.name.startsWith('mobile')) {
    expect(card!.width).toBeGreaterThan(330);
    expect(card!.y).toBeLessThan(320);
    expect(card!.height).toBeLessThan(220);
  }
  const review = await page.locator('.mp-draft-note').boundingBox();
  await expect(page.locator('.mp-draft-note')).toHaveCSS('position', 'sticky');
  expect(review!.y + review!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height
  );
  const axe = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    axe.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((n) => n.target),
    }))
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath('music-loaded.png'),
    fullPage: false,
  });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await create.hover();
  await page.mouse.down();
  await expect
    .poll(() =>
      create.evaluate((button) =>
        parseFloat(getComputedStyle(button).borderRadius)
      )
    )
    .toBe(16);
  await page.screenshot({
    path: info.outputPath('music-pressed.png'),
    fullPage: false,
  });
  await page.mouse.up();
  await expect(
    page.getByRole('textbox', { name: 'Series name' })
  ).toBeFocused();
});

test('curation cards stay capped and adapt to available space in both loading and loaded states', async ({
  page,
}, info) => {
  const playlists = Array.from({ length: 6 }, (_, index) => ({
    ...playlist,
    id: String(index + 1).repeat(22),
    eligible: index !== 4,
    title:
      index === 0
        ? '"bildungsroman indie film protagonist staring out a train window on a rainy day" vibes'
        : index === 1
          ? 'Songs that would make for great ending montages or credits'
          : 'Long evenings and the journeys between them',
  }));
  const body = {
    ...catalog,
    order: playlists.map((item) => item.id),
    selected: playlists.filter((item) => item.eligible).map((item) => item.id),
  };
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/studio/music/catalog', async (route) => {
    await held;
    await route.fulfill({
      json: { revision: { id: 'fixture', body }, playlists },
    });
  });
  await page.route('**/api/studio/music/connection', (route) =>
    route.fulfill({ json: { connected: true } })
  );
  await page.goto('/studio/music');
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
  const widths = [
    320, 390, 599, 600, 703, 704, 736, 740, 839, 840, 1000, 1199, 1200, 1440,
    1480, 1500, 1920,
  ];
  async function measure(state: string) {
    const measurements = [];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
      // WebKit updates native scrollbar geometry on the next painted frame.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      const cards = await page
        .locator('.mp-grid-editing .mp-card')
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getBoundingClientRect().toJSON())
        );
      const grid = (await page.locator('.mp-grid-editing').boundingBox())!;
      expect(cards).toHaveLength(6);
      for (const card of cards) {
        expect(card.width, `${state} at ${width}px`).toBeLessThanOrEqual(480);
        expect(card.height, `${state} at ${width}px`).toBe(172);
        expect(card.x + card.width).toBeLessThanOrEqual(
          grid.x + grid.width + 0.1
        );
      }
      const first = page.locator('.mp-grid-editing .mp-card').first();
      const caption = (await first.locator('.mp-card-caption').boundingBox())!;
      const title = (await first
        .locator(state === 'loaded' ? 'h3' : '.mp-pending-line')
        .first()
        .boundingBox())!;
      const arrow = (await first.locator('.mp-open-icon').boundingBox())!;
      const metadata = (await first.locator('.mp-small').boundingBox())!;
      const art = (await first.locator('.mp-art-frame').boundingBox())!;
      const selection = (await first.locator('.mp-check').boundingBox())!;
      expect(
        selection.y - art.y - art.height,
        `${state} at ${width}px`
      ).toBeLessThanOrEqual(8.1);
      expect(selection.y + selection.height / 2).toBeCloseTo(
        arrow.y + arrow.height / 2,
        1
      );
      expect(arrow.y, `${state} at ${width}px`).toBeGreaterThanOrEqual(
        title.y + title.height
      );
      expect(arrow.y + arrow.height / 2).toBeCloseTo(
        metadata.y + metadata.height / 2,
        1
      );
      if (state === 'loaded') {
        expect(title.width).toBeCloseTo(caption.width, 1);
        await expect(first.locator('h3')).toHaveCSS('-webkit-line-clamp', '4');
      }
      // Add columns whenever another 340px card and its gap fit the content.
      expect(
        cards.filter((card) => card.y === cards[0].y).length,
        `${state} at ${width}px`
      ).toBe(Math.max(1, Math.floor((grid.width + 24) / 364)));
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth
        )
      ).toBe(false);
      measurements.push(cards);
      if ([390, 839, 1199, 1200, 1440, 1920].includes(width))
        await page.screenshot({
          path: info.outputPath(`curation-${state}-${width}.png`),
          fullPage: false,
        });
    }
    return measurements;
  }
  const pending = await measure('loading');
  release();
  await expect(page.locator('.mp-card-pending')).toHaveCount(0);
  const loaded = await measure('loaded');
  expect(loaded).toEqual(pending);
  const before = loaded[widths.indexOf(1199)][0].width;
  const after = loaded[widths.indexOf(1200)][0].width;
  expect(Math.abs(after - before)).toBeLessThan(24);
  // Filtering to a lone item must preserve its track instead of stretching it.
  await page
    .getByRole('button', { name: 'Choose playlist collection', exact: true })
    .click();
  await page
    .locator('.mp-series-nav')
    .getByRole('link', { name: /Long evenings and the journeys/ })
    .click();
  await expect(page.locator('.mp-card')).toHaveCount(1);
  expect((await page.locator('.mp-card').boundingBox())!.width).toBe(
    loaded.at(-1)![0].width
  );
  for (const width of [320, 390, 839, 1199, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const card = page.locator('.mp-card');
    const bounds = (await card.boundingBox())!;
    const controls = (await card.locator('.mp-card-controls').boundingBox())!;
    await expect(card.locator('h3')).toHaveCSS('-webkit-line-clamp', '4');
    expect(bounds.height).toBe(172);
    expect(controls.y + controls.height).toBeLessThanOrEqual(
      bounds.y + bounds.height - 12
    );
  }
  await page
    .getByRole('button', { name: 'Choose playlist collection', exact: true })
    .click();
  await page
    .locator('.mp-series-nav')
    .getByRole('link', { name: /All playlists/ })
    .click();
  await page.setViewportSize({ width: 320, height: 900 });
  await page
    .getByRole('button', { name: 'Reorder playlists', exact: true })
    .click();
  const narrow = page.locator('.mp-card').first();
  await expect(narrow.locator('.mp-order-buttons')).toBeVisible();
  expect((await narrow.boundingBox())!.height).toBe(220);
  const title = (await narrow.locator('h3').boundingBox())!;
  const caption = (await narrow.locator('.mp-card-caption').boundingBox())!;
  expect(title.width).toBe(caption.width);
  await page
    .getByRole('button', { name: 'Finish reordering', exact: true })
    .click();
  await expect(narrow.locator('.mp-order-buttons')).toBeHidden();
  expect((await narrow.boundingBox())!.height).toBe(172);
  await page
    .getByRole('button', { name: 'Reorder playlists', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Choose playlist collection', exact: true })
    .click();
  await page
    .locator('.mp-series-nav')
    .getByRole('link', { name: /Long evenings and the journeys/ })
    .click();
  await expect(
    page.getByRole('button', { name: 'Reorder playlists', exact: true })
  ).toBeDisabled();
  await expect(page.locator('.mp-order-buttons')).toBeHidden();
});

test('gallery arrows share the metadata row and leave titles the full card width', async ({
  page,
}, info) => {
  const playlists = [
    {
      ...playlist,
      title:
        'bildungsroman indie film protagonist staring out a train window on a rainy day vibes '
          .repeat(4)
          .trim(),
    },
    { ...playlist, id: '2'.repeat(22), title: '2026.' },
    {
      ...playlist,
      id: '3'.repeat(22),
      title: 'SummerWithoutAnySpaces'.repeat(12),
    },
  ];
  let featured = false;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/studio/music/catalog', async (route) => {
    await held;
    await route.fulfill({
      json: {
        revision: {
          id: 'fixture',
          body: {
            ...catalog,
            lead: featured ? id : null,
            series: [
              ...catalog.series,
              { id: 'quiet', title: 'A quiet interlude', playlistIds: [] },
            ],
            order: playlists.map((item) => item.id),
            selected: playlists.map((item) => item.id),
          },
        },
        playlists,
      },
    });
  });
  await page.route('**/api/studio/music/connection', (route) =>
    route.fulfill({ json: { connected: true } })
  );
  await page.goto('/studio/music');
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
  await page
    .getByRole('button', { name: 'Open menu for Music', exact: true })
    .click();
  await page.getByRole('button', { name: 'View gallery', exact: true }).click();
  await expect(page.locator('.mp-loading-status')).toHaveText(
    'Loading Willie’s playlists…'
  );
  const pendingSizes = new Map<number, { width: number; height: number }>();
  async function check(state: 'loading' | 'loaded') {
    for (const width of [320, 390, 599, 600, 839, 840, 1199, 1200, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          )
      );
      const card = page
        .locator('.mp-grid:not(.mp-grid-editing) .mp-card')
        .first();
      await card.scrollIntoViewIfNeeded();
      const caption = (await card.locator('.mp-card-caption').boundingBox())!;
      const title = (await card
        .locator(state === 'loaded' ? 'h3' : '.mp-pending-line')
        .first()
        .boundingBox())!;
      const arrow = (await card.locator('.mp-open-icon').boundingBox())!;
      const bounds = (await card.boundingBox())!;
      expect(bounds.height).toBeLessThanOrEqual(608);
      const artwork = (await card.locator('.mp-art-frame').boundingBox())!;
      expect(artwork.x - bounds.x).toBeCloseTo(12, 1);
      expect(artwork.y - bounds.y).toBeCloseTo(12, 1);
      expect(bounds.x + bounds.width - artwork.x - artwork.width).toBeCloseTo(
        12,
        1
      );
      if (state === 'loading')
        pendingSizes.set(width, { width: bounds.width, height: bounds.height });
      expect(arrow.y, `${state} at ${width}px`).toBeGreaterThanOrEqual(
        title.y + title.height
      );
      if (state === 'loaded') {
        expect({ width: bounds.width, height: bounds.height }).toEqual(
          pendingSizes.get(width)
        );
        const short = await checkLoadedGalleryRows(bounds);
        const shortTitle = (await short.locator('h3').boundingBox())!;
        const shortMetadata = (await short.locator('.mp-small').boundingBox())!;
        expect(
          shortMetadata.y - shortTitle.y - shortTitle.height
        ).toBeLessThanOrEqual(16.1);
        const lineHeight = await card
          .locator('h3')
          .evaluate((node) => parseFloat(getComputedStyle(node).lineHeight));
        expect(title.height).toBeLessThanOrEqual(lineHeight * 4);
        expect(title.width).toBeCloseTo(caption.width, 1);
        const metadata = (await card.locator('.mp-small').boundingBox())!;
        expect(arrow.y + arrow.height / 2).toBeCloseTo(
          metadata.y + metadata.height / 2,
          1
        );
        await expect(
          card.getByRole('link', {
            name: `Open ${playlists[0].title}`,
            exact: true,
          })
        ).toBeVisible();
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth
        )
      ).toBe(false);
      if ([390, 839, 1920].includes(width)) {
        await page.screenshot({
          path: info.outputPath(`gallery-${state}-${width}.png`),
          fullPage: false,
        });
        await card.screenshot({
          path: info.outputPath(`gallery-card-${state}-${width}.png`),
        });
      }
    }
  }
  async function checkLoadedGalleryRows(bounds: { y: number; height: number }) {
    const short = page.locator('.mp-card').nth(1);
    const shortBounds = (await short.boundingBox())!;
    if (Math.abs(shortBounds.y - bounds.y) < 0.1) {
      expect(shortBounds.height).toBeCloseTo(bounds.height, 1);
      expect(
        (await short.locator('.mp-card-open').boundingBox())!.height
      ).toBeCloseTo(shortBounds.height - 24, 1);
    } else {
      expect(shortBounds.height).toBeLessThan(bounds.height);
    }
    const rows = await page.locator('.mp-card').evaluateAll((nodes) =>
      nodes.map((node) => {
        const { y, height } = node.getBoundingClientRect();
        return { y, height };
      })
    );
    for (const row of rows) {
      const heights = rows
        .filter((item) => Math.abs(item.y - row.y) < 0.1)
        .map((item) => item.height);
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.1);
    }
    return short;
  }
  await check('loading');
  release();
  await expect(page.locator('.mp-card-pending')).toHaveCount(0);
  await check('loaded');
  const navigation = page.locator('.mp-series-nav');
  await navigation.getByRole('link', { name: /A quiet interlude/ }).click();
  await expect(page.locator('.mp-empty')).toContainText(
    'Explore All playlists for more of Willie’s music.'
  );
  await expect(page.locator('.mp-empty')).not.toContainText(
    'add it to this series'
  );
  await navigation.getByRole('link', { name: /All playlists/ }).click();
  await page
    .locator('.mp-card')
    .first()
    .getByRole('link', { name: `Open ${playlists[0].title}`, exact: true })
    .click();
  await expect(page.locator('#mp-detail-title')).toHaveText(playlists[0].title);
  featured = true;
  await page.goto('/studio/music');
  await page
    .getByRole('button', { name: 'Open menu for Music', exact: true })
    .click();
  await page.getByRole('button', { name: 'View gallery', exact: true }).click();
  const feature = page.locator('.mp-card-lead');
  await expect(feature).toBeVisible();
  for (const width of [390, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    const title = feature.locator('h3');
    const height = (await title.boundingBox())!.height;
    const leading = await title.evaluate((node) =>
      parseFloat(getComputedStyle(node).lineHeight)
    );
    expect(height).toBeLessThanOrEqual(4 * leading + 0.1);
    const open = feature.getByRole('link', {
      name: width <= 599 ? `Open ${playlists[0].title}` : 'Open playlist',
      exact: true,
    });
    await open.scrollIntoViewIfNeeded();
    await expect(open).toBeInViewport();
    await page.screenshot({
      path: info.outputPath(`gallery-feature-long-${width}.png`),
      fullPage: false,
    });
  }
});

test('populated curation keeps long titles, series, filtering and ordering usable', async ({
  page,
}, info) => {
  const playlists = [
    playlist,
    {
      ...playlist,
      id: '2'.repeat(22),
      title:
        'A long playlist title that preserves the sequence across several evenings',
      trackCount: 1,
    },
    {
      ...playlist,
      id: '3'.repeat(22),
      title: 'Summer in the city',
      trackCount: 26,
    },
  ];
  const body = {
    ...catalog,
    order: playlists.map((p) => p.id),
    selected: [id, playlists[1].id],
    series: [
      {
        id: 'evenings',
        title: 'Long evenings and the journeys between them',
        playlistIds: [id, playlists[1].id],
      },
    ],
  };
  await page.route('**/api/studio/music/catalog', (route) =>
    route.fulfill({ json: { revision: { id: 'fixture', body }, playlists } })
  );
  await page.route('**/api/studio/music/connection', (route) =>
    route.fulfill({ json: { connected: true } })
  );
  await page.goto('/studio/music');
  await expect(page.locator('.mp-card')).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
  const card = page.locator('.mp-card').first();
  await expect(card.locator('.mp-order-buttons')).toBeHidden();
  await page
    .getByRole('button', { name: 'Reorder playlists', exact: true })
    .click();
  const earlier = card.getByRole('button', { name: /earlier/ });
  const later = card.getByRole('button', { name: /later/ });
  await expect(earlier).toBeDisabled();
  await expect(later).toBeEnabled();
  await later.click();
  await expect(page.locator('.mp-card').first()).toContainText(
    playlists[1].title
  );
  await page
    .locator('.mp-library-filters')
    .getByRole('button', { name: /^Not included/ })
    .click();
  await expect(page.locator('.mp-card')).toHaveCount(1);
  await expect(page.locator('.mp-card')).toContainText('Summer in the city');
  await page
    .locator('.mp-library-filters')
    .getByRole('button', { name: /^All/ })
    .click();
  await page
    .getByRole('button', { name: 'Choose playlist collection', exact: true })
    .click();
  await page
    .getByRole('link', { name: /Long evenings and the journeys/ })
    .click();
  await expect(page.locator('.mp-card')).toHaveCount(2);
  await expect(
    page.getByRole('heading', {
      name: 'Long evenings and the journeys between them',
    })
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('music-series.png'),
    fullPage: false,
  });
  await page
    .getByRole('button', { name: 'Choose playlist collection', exact: true })
    .click();
  await page.getByRole('link', { name: /^All playlists/ }).click();
  await page.screenshot({
    path: info.outputPath('music-populated.png'),
    fullPage: false,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  ).toBe(false);
  // A narrow phone must still show every filter and usable touch controls.
  if (info.project.name.startsWith('mobile')) {
    await page.setViewportSize({ width: 320, height: 700 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth
      )
    ).toBe(false);
    for (const button of await page
      .locator('.mp-library-filters button')
      .all()) {
      await expect(button).toBeInViewport();
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({
      path: info.outputPath('music-narrow.png'),
      fullPage: false,
    });
  }
});

test('page families keep content and controls legible at the full viewport', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const alignment: Record<string, unknown> = {};
  for (const path of [
    '/',
    '/search?q=transit',
    '/writings',
    '/projects',
    '/initiatives',
    '/media',
    '/brand',
    '/sitemap',
    '/status',
    '/admin/status',
    '/studio',
    '/music',
    '/this-page-does-not-exist',
  ]) {
    const response = await page.goto(path);
    expect(response!.status()).toBe(
      path.includes('does-not-exist') ? 404 : 200
    );
    await expect(page.locator('main')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth
      ),
      path
    ).toBe(false);
    if (path === '/media' || path === '/writings')
      alignment[path] = await page.evaluate(() => {
        const main = document.querySelector('main')!.getBoundingClientRect();
        const title = document
          .querySelector('main h1')!
          .getBoundingClientRect();
        return {
          x: main.x,
          width: main.width,
          titleX: title.x,
          titleY: title.y,
        };
      });
    await page.screenshot({
      path: info.outputPath(`${path.replace(/[^a-z0-9]/gi, '_')}.png`),
      fullPage: false,
    });
  }
  expect(alignment['/media']).toEqual(alignment['/writings']);
});

test('Studio uses the status slot for its loaded count and retains the first writing position', async ({
  page,
}, info) => {
  const response = await page.request.get('/api/studio/documents');
  const data = await response.json();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/studio/documents', async (route) => {
    await held;
    await route.fulfill({ json: data });
  });
  await page.goto('/studio');
  await expect(page.getByRole('status')).toContainText('Loading your writings');
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
  const pending = await page.locator('main article').first().boundingBox();
  await page.screenshot({
    path: info.outputPath('studio-pending.png'),
    fullPage: false,
  });
  release();
  await expect(page.getByRole('status')).toContainText(
    `${data.documents.length} ${data.documents.length === 1 ? 'writing' : 'writings'}`
  );
  const ready = await page.locator('main article').first().boundingBox();
  expect(ready!.y).toBe(pending!.y);
  expect(ready!.width).toBe(pending!.width);
  if (info.project.name.startsWith('mobile'))
    expect(ready!.y).toBeLessThan(260);
  await page.screenshot({
    path: info.outputPath('studio-loaded.png'),
    fullPage: false,
  });
});

test('authenticated thumbnails load without exposing preview assets', async ({
  page,
  request,
}) => {
  for (const path of ['/projects', '/media']) {
    await page.goto(path);
    const image = page.locator('main img').first();
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        image.evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0
        )
      )
      .toBe(true);
    const src = await image.getAttribute('src');
    expect(src).not.toContain('/_next/image');
    const denied = await request.get(src!, {
      headers: { 'cf-access-jwt-assertion': '' },
    });
    expect(denied.status()).toBe(401);
  }
});

test('playlist series context identifies the series and keeps its position intact', async ({
  page,
}, info) => {
  const title =
    'Songs for staring out of a train window on a rainy day, from the opening scene to the closing credits';
  const records = Array.from({ length: 23 }, (_, index) => ({
    ...playlist,
    id: String(index + 1).padStart(22, '0'),
  }));
  const ids = records.map((record) => record.id);
  await page.route('**/api/studio/music/catalog', (route) =>
    route.fulfill({
      json: {
        revision: {
          id: 'fixture',
          body: {
            ...catalog,
            order: ids,
            selected: ids,
            series: [{ id: 'cinematic', title, playlistIds: ids }],
          },
        },
        playlists: records,
      },
    })
  );
  await page.route('**/api/studio/music/connection', (route) =>
    route.fulfill({ json: { connected: true } })
  );
  await page.goto(`/studio/music?series=cinematic&detail=${ids[1]}`);
  const context = page.locator('.mp-detail-context');
  await expect(context.locator('.mp-detail-series-label')).toHaveText('Series');
  await expect(context.locator('.mp-detail-series-name')).toHaveText(title);
  await expect(context.locator('.mp-detail-series-position')).toContainText(
    '02 / 23'
  );
  await expect(page.locator('.mp-detail-bar .mp-detail-position')).toHaveCount(
    0
  );
  await expect(page.locator('.mp-detail-series-name')).toHaveCount(1);
  await expect(context.getByRole('checkbox')).toBeChecked();
  for (const width of [320, 390, 600, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    const layout = await context.evaluate((row) => {
      const name = row.querySelector<HTMLElement>('.mp-detail-series-name')!;
      const position = row.querySelector<HTMLElement>(
        '.mp-detail-series-position'
      )!;
      const visible = position.querySelector<HTMLElement>('[aria-hidden]')!;
      const text = document.createRange();
      text.selectNodeContents(visible);
      return {
        lines: text.getClientRects().length,
        nameFits: name.scrollWidth <= name.clientWidth,
        positionFits: position.scrollWidth <= position.clientWidth,
        contextFits: row.scrollWidth <= row.clientWidth,
      };
    });
    expect(layout, `${width}px`).toEqual({
      lines: 1,
      nameFits: true,
      positionFits: true,
      contextFits: true,
    });
    if (width < 840) {
      const identity = await page
        .locator('.mp-detail-scroll')
        .evaluate((scroller) => {
          const title = scroller.querySelector('h2')!.getBoundingClientRect();
          const art = scroller
            .querySelector('.mp-detail-art')!
            .getBoundingClientRect();
          const series = scroller
            .querySelector('.mp-detail-context')!
            .getBoundingClientRect();
          const css = getComputedStyle(scroller);
          return {
            available:
              scroller.clientWidth -
              parseFloat(css.paddingLeft) -
              parseFloat(css.paddingRight),
            titleWidth: title.width,
            seriesWidth: series.width,
            artworkAboveTitle: art.bottom <= title.top,
            seriesBelowArtwork: series.top >= art.bottom,
            artworkWidth: art.width,
            artworkHeight: art.height,
          };
        });
      expect(identity.titleWidth).toBeCloseTo(identity.available, 0);
      expect(identity.seriesWidth).toBeCloseTo(identity.available, 0);
      expect(identity.artworkAboveTitle).toBe(true);
      expect(identity.seriesBelowArtwork).toBe(true);
      expect(identity.artworkWidth).toBeCloseTo(
        Math.min(identity.available, 280),
        0
      );
      expect(identity.artworkHeight).toBeCloseTo(identity.artworkWidth, 0);
    }
    await page.screenshot({
      path: info.outputPath(`series-context-${width}.png`),
      fullPage: false,
    });
  }
});

test('ending navigation keeps Close and browser Back consistent after leaving a series', async ({
  page,
}) => {
  const ids = ['62XTb89yYS322P7LODBSmU', '5AgpIU7pNfvef8FL9kvbYa'];
  const records = ids.map((id, index) => ({
    ...playlist,
    id,
    title: index > 0 ? 'Williecore' : '36 Hours of Willie: A Playlist',
    tracks: Array.from({ length: index > 0 ? 56 : 300 }, () => ({
      title: 'A song',
      artist: 'An artist',
      duration: '3:00',
      durationMs: 180000,
      kind: 'track',
      url: null,
    })),
    trackCount: index > 0 ? 56 : 300,
  }));
  await page.route('**/api/studio/music/catalog', (route) =>
    route.fulfill({
      json: {
        revision: {
          id: 'fixture',
          body: {
            ...catalog,
            order: ids,
            selected: ids,
            series: [
              { id: 'cinematic', title: 'Cinematic', playlistIds: [ids[0]] },
            ],
          },
        },
        playlists: records,
      },
    })
  );
  await page.route('**/api/studio/music/connection', (route) =>
    route.fulfill({ json: { connected: true } })
  );
  await page.goto('/studio/music?series=cinematic');
  await page
    .getByRole('button', { name: 'Open menu for Music', exact: true })
    .click();
  await page.getByRole('button', { name: 'View gallery', exact: true }).click();
  await expect(page.locator('.mp-card')).toHaveCount(1);
  await page
    .getByRole('link', {
      name: 'Open 36 Hours of Willie: A Playlist',
      exact: true,
    })
    .click();
  const dialog = page.locator('dialog.mp-detail');
  await dialog
    .getByRole('complementary', { name: 'Playlist ending' })
    .getByRole('link', { name: 'Williecore', exact: true })
    .click();
  await expect(page.locator('#mp-detail-title')).toHaveText('Williecore');
  await dialog
    .getByRole('link', { name: 'Close playlist', exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/studio\/music$/);
  await expect(
    page
      .getByRole('navigation', { name: 'Playlist series' })
      .getByRole('link', { name: /^All playlists/ })
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.mp-card')).toHaveCount(2);
  await page.goBack();
  await expect(page).toHaveURL(/\/studio\/music\?series=cinematic$/);
  await expect(
    page
      .getByRole('navigation', { name: 'Playlist series' })
      .getByRole('link', { name: /^Cinematic/ })
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.mp-card')).toHaveCount(1);
  await expect(dialog).toBeHidden();
});

test('detail pages and temporary views fit the same mobile and desktop viewports', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  async function capture(name: string) {
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth
      ),
      name
    ).toBe(false);
    await page.screenshot({
      path: info.outputPath(`${name}.png`),
      fullPage: false,
    });
  }
  await page.goto('/?detail=lvbt');
  await expect(page.locator('dialog.detail')).toBeVisible();
  await capture('home-detail');
  await page.keyboard.press('Escape');
  await page.goto('/initiatives');
  const initiative = await page
    .locator('main a[href^="/initiatives/"]')
    .first()
    .getAttribute('href');
  if (initiative) {
    await page.goto(initiative);
    await capture('initiative-detail');
    const part = await page
      .locator(`main a[href^="${initiative}/"]`)
      .first()
      .getAttribute('href');
    if (part) {
      await page.goto(part);
      expect(
        await page
          .locator('.h-event > p')
          .first()
          .evaluate((el) => getComputedStyle(el).color)
      ).toBe(
        await page
          .locator('.h-event h1')
          .evaluate((el) => getComputedStyle(el).color)
      );
      await capture('initiative-part');
    }
  }
  await page.goto('/projects/parlipro');
  await capture('project-detail');
  const { documents } = await (
    await page.request.get('/api/studio/documents')
  ).json();
  await page.goto(`/writings/${documents[0].slug}`);
  await capture('writing-detail');
  await page.goto(`/studio/${documents[0].id}`);
  await expect(page.locator('.tiptap')).toBeVisible();
  await capture('writing-editor');
  await page.goto('/studio/music');
  await expect(page.locator('.ms-shell')).toBeVisible();
  await capture('music-setup');
  await page.goto('/search');
  await expect(page.locator('.palette-trigger__key').first()).not.toBeEmpty();
  await page.keyboard.press('Meta+k');
  await expect(
    page.getByRole('combobox', { name: 'Search the site or type a command' })
  ).toBeVisible();
  await capture('palette');
});

for (const count of [1, 12]) {
  test(`publication bar stays clear and morphs with ${count} playlists`, async ({
    page,
  }, info) => {
    const playlists = Array.from({ length: count }, (_, index) => ({
      ...playlist,
      id: String(index + 1).padStart(22, '0'),
      title: `Evening collection ${index + 1}`,
    }));
    const body = {
      ...catalog,
      order: playlists.map((p) => p.id),
      selected: playlists.map((p) => p.id),
      series: [],
    };
    await page.route('**/api/studio/music/catalog', (route) =>
      route.fulfill({ json: { revision: { id: 'fixture', body }, playlists } })
    );
    await page.route('**/api/studio/music/connection', (route) =>
      route.fulfill({ json: { connected: true } })
    );
    await page.goto('/studio/music');
    await expect(page.locator('.mp-card')).toHaveCount(count);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
    const bar = page.locator('.mp-draft-note');
    await expect(bar).toHaveCSS('position', 'sticky');
    await bar.evaluate((node) => {
      (window as Window & { __publicationBar?: Element }).__publicationBar =
        node;
    });
    for (const [width, height] of [
      [390, 844],
      [599, 800],
      [600, 800],
      [900, 900],
      [1440, 900],
      [320, 700],
    ]) {
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
      });
      await page.setViewportSize({ width, height });
      await page.evaluate(() => scrollTo(0, 0));
      await expect
        .poll(async () => {
          const box = await bar.boundingBox();
          return Math.round(box!.y + box!.height);
        })
        .toBe(width < 600 ? height : height - 24);
      const bounds = await bar.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      if (width < 600) {
        expect(bounds!.x).toBe(
          await page.evaluate(() => document.body.getBoundingClientRect().x)
        );
        expect(bounds!.width).toBe(
          await page.evaluate(() => document.body.getBoundingClientRect().width)
        );
        expect(bounds!.y + bounds!.height).toBe(height);
      } else {
        expect(bounds!.width).toBeLessThanOrEqual(520);
        expect(bounds!.y + bounds!.height).toBe(height - 24);
      }
      const lastCard = page.locator('.mp-card').last();
      await lastCard.evaluate((node) =>
        node.scrollIntoView({ block: 'end', behavior: 'instant' })
      );
      const lastCardBounds = await lastCard.boundingBox();
      expect(lastCardBounds!.y).toBeGreaterThanOrEqual(0);
      expect(lastCardBounds!.y + lastCardBounds!.height).toBeLessThanOrEqual(
        (await bar.boundingBox())!.y - 15
      );
      await page.screenshot({
        path: info.outputPath(`last-playlist-${width}.png`),
        fullPage: false,
      });
      await assertPublicationBarLeavesTargetsClear(
        await lastCard
          .locator('a[href], button:not(:disabled), input:not(:disabled)')
          .all()
      );
      await page.evaluate(() =>
        scrollTo(0, document.documentElement.scrollHeight)
      );
      const footer = await page.locator('.site-footer').boundingBox();
      const stoppedBar = await bar.boundingBox();
      expect(stoppedBar!.y + stoppedBar!.height).toBeLessThanOrEqual(footer!.y);
      await assertPublicationBarLeavesTargetsClear(
        await page.locator('.site-footer a[href]').all()
      );
      await page.evaluate(() =>
        scrollTo(0, document.documentElement.scrollHeight)
      );
      expect(
        await bar.evaluate(
          (node) =>
            node ===
            (window as Window & { __publicationBar?: Element }).__publicationBar
        )
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath(`publication-${width}.png`),
        fullPage: false,
      });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const width of [900, 390, 600, 599]) {
      // Sample actual animation frames, including reversals across the breakpoint.
      await bar.evaluate((node) => {
        const samples: {
          radius: string;
          contained: boolean;
          focusClear: boolean;
          focusBottom: number;
          barTop: number;
        }[] = [];
        (window as Window & { __barFrames?: typeof samples }).__barFrames =
          samples;
        const start = performance.now();
        const sample = () => {
          const box = node.getBoundingClientRect();
          const focused = document.activeElement;
          samples.push({
            radius: getComputedStyle(node).borderTopLeftRadius,
            focusBottom: focused?.getBoundingClientRect().bottom ?? 0,
            barTop: box.top,
            focusClear:
              !(focused instanceof HTMLElement) ||
              !focused.closest('.mp-grid, .site-footer') ||
              focused.getBoundingClientRect().bottom <= box.top ||
              focused.getBoundingClientRect().top >= box.bottom,
            contained:
              box.left >= -1 &&
              box.right <= innerWidth + 1 &&
              box.bottom <= innerHeight + 1 &&
              box.bottom <=
                document.querySelector('.site-footer')!.getBoundingClientRect()
                  .top +
                  1,
          });
          if (performance.now() - start < 650) requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      await page.setViewportSize({ width, height: 844 });
      await expect
        .poll(() => bar.evaluate((node) => node.getAnimations().length))
        .toBeGreaterThan(0);
      await bar.evaluate(async (node) => {
        await Promise.all(
          node.getAnimations().map((animation) => animation.finished)
        );
      });
      const samples = await page.evaluate(
        () =>
          (
            window as Window & {
              __barFrames?: {
                radius: string;
                contained: boolean;
                focusClear: boolean;
                focusBottom: number;
                barTop: number;
              }[];
            }
          ).__barFrames!
      );
      expect(samples.length).toBeGreaterThan(2);
      expect(samples.every((sample) => sample.contained)).toBe(true);
      expect(
        samples.filter((sample) => !sample.focusClear),
        `Resize to ${width}`
      ).toEqual([]);
      expect(
        new Set(samples.map((sample) => sample.radius)).size
      ).toBeGreaterThan(2);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(bar).toHaveCSS('transition-duration', '0s');
  });
}

test('page scrollbar gutters keep start and end spacing balanced', async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  await page.route('**/api/studio/music/catalog', (route) =>
    route.fulfill({
      json: {
        revision: { id: 'fixture', body: catalog },
        playlists: [playlist],
      },
    })
  );
  await page.route('**/api/studio/music/connection', (route) =>
    route.fulfill({ json: { connected: true } })
  );
  for (const width of [390, 1440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/studio/music', '/media', '/writings', '/']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => document.fonts.ready);
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const bounds = document.body.getBoundingClientRect();
              return Math.abs(bounds.left - (innerWidth - bounds.right));
            }),
          { message: `Balanced viewport gutters on ${path} at ${width}px` }
        )
        .toBeLessThanOrEqual(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth
        )
      ).toBe(false);
      if (path === '/studio/music') {
        await expect(page.locator('.mp-card')).toHaveCount(1);
        await expect(
          page.getByRole('link', {
            name: `Open ${playlist.title}`,
            exact: true,
          })
        ).toBeVisible();
        const creation = await page
          .getByRole('button', { name: 'Create a series' })
          .boundingBox();
        const rail = await page.locator('.mp-rail').boundingBox();
        expect(creation!.x).toBeGreaterThanOrEqual(rail!.x);
        expect(creation!.x + creation!.width).toBeLessThanOrEqual(
          rail!.x + rail!.width + 1
        );
        const before = await page.locator('.mp-card').first().boundingBox();
        await page
          .getByRole('link', { name: `Open ${playlist.title}`, exact: true })
          .click();
        await expect(page.locator('dialog.mp-detail')).toBeVisible();
        const dialogBounds = await page
          .locator('dialog.mp-detail')
          .boundingBox();
        expect(
          Math.abs(
            dialogBounds!.x - (width - dialogBounds!.x - dialogBounds!.width)
          )
        ).toBeLessThanOrEqual(1);
        const after = await page.locator('.mp-card').first().boundingBox();
        expect(after!.x).toBe(before!.x);
        expect(after!.width).toBe(before!.width);
        await expect(page.locator('.mp-detail-scroll')).toHaveCSS(
          'scrollbar-width',
          'thin'
        );
        await expect(page.locator('.mp-detail-bar')).toHaveCSS(
          'scrollbar-gutter',
          'stable both-edges'
        );
        const details = await page
          .locator('.mp-detail-scroll')
          .evaluate((node) => {
            const frame = node.getBoundingClientRect();
            const boxes = Array.from(node.children)
              .map((child) => child.getBoundingClientRect())
              .filter((box) => box.width > 0);
            return {
              start: Math.min(...boxes.map((box) => box.left)) - frame.left,
              end: frame.right - Math.max(...boxes.map((box) => box.right)),
            };
          });
        expect(Math.abs(details.start - details.end)).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: info.outputPath(`music-gutters-dialog-${width}.png`),
          fullPage: false,
        });
        await page
          .getByRole('link', { name: 'Close playlist', exact: true })
          .click();
        await expect(page.locator('dialog.mp-detail')).not.toBeVisible();
        await page.addStyleTag({ content: 'nextjs-portal{display:none}' });
        await page.screenshot({
          path: info.outputPath(`music-gutters-${width}.png`),
          fullPage: false,
        });
        await page.getByRole('button', { name: 'Review changes' }).click();
        const reviewBounds = await page
          .locator('dialog.mp-review')
          .boundingBox();
        expect(
          Math.abs(
            reviewBounds!.x - (width - reviewBounds!.x - reviewBounds!.width)
          )
        ).toBeLessThanOrEqual(1);
        await expect(page.locator('.mp-review-body')).toHaveCSS(
          'scrollbar-width',
          'thin'
        );
        for (const selector of [
          '.mp-review-header',
          '.mp-review-body',
          '.mp-review-actions',
        ])
          await expect(page.locator(selector)).toHaveCSS(
            'scrollbar-gutter',
            'stable both-edges'
          );
        const review = await page.evaluate(() => {
          const title = document
            .querySelector('#mp-review-title')!
            .getBoundingClientRect();
          const summary = document
            .querySelector('.mp-review-summary')!
            .getBoundingClientRect();
          const body = document
            .querySelector('.mp-review-body')!
            .getBoundingClientRect();
          return {
            heading: title.left,
            content: summary.left,
            start: summary.left - body.left,
            end: body.right - summary.right,
          };
        });
        expect(Math.abs(review.heading - review.content)).toBeLessThanOrEqual(
          1
        );
        expect(Math.abs(review.start - review.end)).toBeLessThanOrEqual(1);
        await page.screenshot({
          path: info.outputPath(`music-gutters-review-${width}.png`),
          fullPage: false,
        });
      }
      if (path === '/') {
        await page.evaluate(() =>
          scrollTo(0, document.documentElement.scrollHeight)
        );
        await expect
          .poll(() =>
            page.evaluate(() => {
              const frame = document.body.getBoundingClientRect();
              const sheet = document
                .querySelector('body > .grow')!
                .getBoundingClientRect();
              return Math.abs(
                sheet.left - frame.left - (frame.right - sheet.right)
              );
            })
          )
          .toBeLessThanOrEqual(1);
      }
    }
  }
});
