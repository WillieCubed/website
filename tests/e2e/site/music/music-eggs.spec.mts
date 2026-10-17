import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';

test.skip(
  process.env.SITE_MODE !== 'public' || process.env.MUSIC_E2E !== '1',
  'Uses the isolated public Music database.'
);
const entries = [
  {
    id: '7qgLqpNN5w1KwOnhEVojqz',
    title:
      '"bildungsroman indie film protagonist staring out a train window on a rainy day" vibes',
    alias: 'main character',
  },
  {
    id: '1CrRioD0EmSlk5jyndh6Oz',
    title: 'Songs that would make for great ending montages or credits',
    alias: 'roll credits',
  },
  {
    id: '732snle3EiiBBSEYEyJzYv',
    title: 'Songs with unusually long entrances',
    alias: 'get to the point',
  },
];
let db: Pool;
const approvedIds: string[] = JSON.parse(
  readFileSync(
    new URL('../../../../content/music/catalog.json', import.meta.url),
    'utf8'
  )
).catalog.selected;
async function excludeAllApproved() {
  await db.query('DELETE FROM music_approved_cache');
  await db.query(
    `INSERT INTO music_approved_cache(id,body,checked_at,eligible)
     SELECT id, jsonb_build_object('id',id,'eligible',false,'checkedAt',now()),now(),false
     FROM jsonb_array_elements_text($1::jsonb) AS ids(id)`,
    [JSON.stringify(approvedIds)]
  );
}
test.beforeAll(async () => {
  const url = new URL(process.env.STUDIO_DATABASE_URL!);
  if (!url.searchParams.get('options')?.includes('search_path=studio_e2e_'))
    throw new Error('Requires an isolated fixture schema.');
  db = new Pool({ connectionString: url.href });
});
test.afterAll(async () => {
  await db?.end();
});
test.beforeEach(async () => {
  await db.query('DELETE FROM music_approved_cache');
  for (const entry of entries) {
    const tracks = Array.from({ length: 12 }, (_, i) => ({
      title: `Closing scene ${i + 1}`,
      artist: `Fixture artist ${i + 1}`,
      duration: '3:12',
      durationMs: 192000,
      kind: 'track',
      url: null,
    }));
    const body = {
      ...entry,
      description: '',
      image: null,
      url: `https://open.spotify.com/playlist/${entry.id}`,
      ownerId: 'fixture',
      eligible: true,
      snapshot: 'fixture',
      tracks,
      trackCount: tracks.length,
      checkedAt: new Date().toISOString(),
      error: null,
    };
    await db.query(
      'INSERT INTO music_approved_cache(id,body,checked_at,eligible) VALUES($1,$2,now(),true)',
      [entry.id, JSON.stringify(body)]
    );
  }
});

const longTrackTitle =
  'A quiet, luminous evening that keeps unfolding long after the last train has left the station (Live at the end of the world)';

test('tabbing between playlists never flashes a ring on the previous artwork', async ({
  page,
  browserName,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/music');
  const cards = page.locator('.mp-card');
  const first = cards.nth(0).locator('.mp-card-open');
  const second = cards.nth(1).locator('.mp-card-open');
  await first.focus();
  await expect(first).toBeFocused();
  await first.evaluate(async (el) => {
    await Promise.all(
      el.getAnimations({ subtree: true }).map((a) => a.finished)
    );
  });
  // WebKit follows macOS's default: Option+Tab includes links.
  const keys =
    browserName === 'webkit'
      ? ['Alt+Tab', 'Alt+Shift+Tab']
      : ['Tab', 'Shift+Tab'];
  for (const [index, key] of keys.entries()) {
    await page.keyboard.press(key);
    await expect(index === 0 ? second : first).toBeFocused();
    const flashes = await page.locator('.mp-grid').evaluate(async (grid) => {
      const frames = [...grid.querySelectorAll('.mp-art-frame')].slice(0, 2);
      const flashes: string[] = [];
      const start = performance.now();
      do {
        for (const frame of frames) {
          const style = getComputedStyle(frame);
          if (
            style.outlineStyle !== 'none' &&
            parseFloat(style.outlineWidth) > 0 &&
            style.outlineColor !== 'rgba(0, 0, 0, 0)'
          )
            flashes.push(style.outline);
        }
        await new Promise(requestAnimationFrame);
      } while (performance.now() - start < 240);
      return flashes;
    });
    expect(flashes, `Artwork outlines while pressing ${key}`).toEqual([]);
  }
  await expect(cards.nth(0)).toHaveCSS('outline-style', 'solid');
  await expect(cards.nth(1)).toHaveCSS('outline-style', 'none');
  await page.screenshot({ path: testInfo.outputPath('keyboard-focus.png') });
  await page.keyboard.press('Enter');
  await expect(page.locator('dialog.mp-detail')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(first).toBeFocused();
});

async function seedLongTrackList() {
  const tracks = Array.from({ length: 105 }, (_, index) => ({
    title: index === 100 ? longTrackTitle : `Song ${index + 1}`,
    artist:
      index === 100
        ? 'Beyoncé and a very long list of collaborators'
        : 'Fixture artist',
    duration: index === 100 ? '123:45' : '3:12',
    durationMs: 192000,
    kind: index === 2 ? 'local' : 'track',
    unavailable: index === 1,
    url:
      index === 2
        ? null
        : `https://open.spotify.com/track/${String(index + 1).padStart(22, '0')}`,
  }));
  await db.query(
    `UPDATE music_approved_cache SET body = body || $2::jsonb WHERE id = $1`,
    [entries[0].id, JSON.stringify({ tracks, trackCount: tracks.length })]
  );
}

async function seedEndingPlaylist(count: number, id: string, title: string) {
  const { rows } = await db.query(
    'SELECT body FROM music_approved_cache WHERE id=$1',
    [entries[0].id]
  );
  const source = rows[0].body;
  const tracks = Array.from({ length: count }, (_, index) => ({
    ...source.tracks[0],
    title: `Song ${index + 1}`,
  }));
  const body = {
    ...source,
    id,
    title,
    tracks,
    trackCount: count,
    url: `https://open.spotify.com/playlist/${id}`,
  };
  await db.query(
    'INSERT INTO music_approved_cache(id,body,checked_at,eligible) VALUES($1,$2,now(),true) ON CONFLICT(id) DO UPDATE SET body=excluded.body, checked_at=excluded.checked_at, eligible=true',
    [id, JSON.stringify(body)]
  );
}

test('playful endings follow complete long lists and stay clear of the last track', async ({
  page,
}) => {
  for (const [count, message] of [
    [49, null],
    [50, 'You found the end. For now.'],
    [150, 'That was the extended cut.'],
    [300, 'That was the extended cut of the extended cut.'],
  ] as const) {
    await seedEndingPlaylist(count, entries[0].id, entries[0].title);
    await page.goto(`/music?detail=${entries[0].id}`);
    const dialog = page.locator('dialog.mp-detail');
    const ending = dialog.getByRole('complementary', {
      name: 'Playlist ending',
    });
    if (!message) {
      await expect(ending).toHaveCount(0);
      continue;
    }
    await expect(ending).toHaveText(message);
    await dialog.locator('.mp-detail-scroll').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    const last = await dialog
      .locator('.mp-track-list > li')
      .last()
      .boundingBox();
    const note = await ending.boundingBox();
    const port = await dialog.locator('.mp-detail-scroll').boundingBox();
    expect(note!.y).toBeGreaterThanOrEqual(last!.y + last!.height + 16);
    expect(note!.y + note!.height).toBeLessThanOrEqual(
      port!.y + port!.height - 16
    );
    expect(await ending.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      false
    );
    const alignment = await dialog.evaluate((el) => ({
      title: el
        .querySelector('.mp-track-list > li:last-child .mp-track-title')!
        .getBoundingClientRect().left,
      ending: el.querySelector('.mp-playlist-ending p')!.getBoundingClientRect()
        .left,
      fill: getComputedStyle(el.querySelector('.mp-playlist-ending')!)
        .backgroundColor,
      surface: getComputedStyle(el).backgroundColor,
    }));
    expect(alignment.ending).toBeCloseTo(alignment.title, 1);
    expect(alignment.fill).not.toBe(alignment.surface);
  }
  expect(
    (await new AxeBuilder({ page }).include('dialog.mp-detail').analyze())
      .violations
  ).toEqual([]);
});

test('the shorter-version ending opens available Williecore with and without scripts', async ({
  page,
  browser,
}) => {
  const collection = '62XTb89yYS322P7LODBSmU';
  const shorter = '5AgpIU7pNfvef8FL9kvbYa';
  await seedEndingPlaylist(300, collection, '36 Hours of Willie: A Playlist');
  await seedEndingPlaylist(56, shorter, 'Williecore');
  await page.goto(`/music?detail=${collection}`);
  const ending = page.getByRole('complementary', { name: 'Playlist ending' });
  await expect(ending).toContainText('There was a shorter version.');
  const link = ending.getByRole('link', { name: 'Williecore', exact: true });
  await expect(link).toHaveAttribute('href', `/music?detail=${shorter}`);
  await link.click();
  await expect(page.locator('#mp-detail-title')).toHaveText('Williecore');
  await expect(page.locator('#mp-detail-title')).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/music\\?detail=${shorter}$`));
  expect(
    await page.locator('.mp-detail-scroll').evaluate((el) => el.scrollTop)
  ).toBe(0);
  await expect(page.locator('.mp-track-list > li')).toHaveCount(56);
  const native = await browser.newContext({
    baseURL: process.env.STUDIO_TEST_ORIGIN,
    javaScriptEnabled: false,
    viewport: page.viewportSize()!,
  });
  try {
    const nativePage = await native.newPage();
    await nativePage.goto(`/music?detail=${collection}`);
    await nativePage
      .getByRole('complementary', { name: 'Playlist ending' })
      .getByRole('link', { name: 'Williecore', exact: true })
      .click();
    await expect(nativePage.locator('#mp-detail-title')).toHaveText(
      'Williecore'
    );
    await expect(nativePage.locator('.mp-track-list > li')).toHaveCount(56);
  } finally {
    await native.close();
  }
  await db.query('UPDATE music_approved_cache SET eligible=false WHERE id=$1', [
    shorter,
  ]);
  await page.goto(`/music?detail=${collection}`);
  await expect(ending.getByRole('link')).toHaveCount(0);
  await expect(ending).toHaveText(
    'That was the extended cut of the extended cut.'
  );
});

test('long playlists prioritize songs without a second search interface', async ({
  page,
}) => {
  await seedLongTrackList();
  await page.route('**/pagefind/**', (route) => route.abort());
  await page.goto(`/music?detail=${entries[0].id}`);
  const dialog = page.locator('dialog.mp-detail');
  const rows = dialog.locator('.mp-track-list > li');
  await expect(dialog.getByRole('searchbox')).toHaveCount(0);
  await expect(dialog.getByRole('search')).toHaveCount(0);
  await expect(
    dialog.getByRole('button', { name: /find a track|clear track search/i })
  ).toHaveCount(0);
  await expect(rows).toHaveCount(105);
  await expect(rows.nth(100)).toHaveAttribute('value', '101');
  await expect(rows.nth(100)).toContainText(longTrackTitle);
  const heading = await dialog.locator('.mp-track-heading').boundingBox();
  const firstRow = await rows.first().boundingBox();
  expect(firstRow!.y - heading!.y - heading!.height).toBeLessThanOrEqual(16);
  // Site-wide Search remains available independently of the track list.
  const firstTrack = rows.first().getByRole('link');
  await firstTrack.focus();
  await firstTrack.press('Control+k');
  await expect(page.getByRole('combobox')).toBeVisible();
  await page.getByRole('combobox').press('Escape');
  await expect(firstTrack).toBeFocused();
  await expect(rows).toHaveCount(105);
  await dialog.getByRole('button', { name: 'Next playlist' }).click();
  await expect(rows).toHaveCount(12);
  await dialog.getByRole('button', { name: 'Previous playlist' }).click();
  await expect(rows).toHaveCount(105);
});

test('the compact toolbar title appears only after the heading leaves view and never crowds controls', async ({
  page,
}) => {
  await seedLongTrackList();
  await page.goto(`/music?detail=${entries[0].id}`);
  const dialog = page.locator('dialog.mp-detail');
  const port = dialog.locator('.mp-detail-scroll');
  const title = dialog.locator('.mp-detail-toolbar-title');
  const bar = dialog.locator('.mp-detail-bar');
  await expect(title).toHaveCount(1);
  await expect(title).toHaveAttribute('aria-hidden', 'true');
  for (const width of [320, 390, 600, 839, 840, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await port.evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(title).not.toBeVisible();
    await expect(bar).not.toHaveAttribute('data-scrolled');
    const restingFill = await bar.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    const before = await dialog.locator('.mp-detail-pagination').boundingBox();
    if (width >= 840) {
      await port.evaluate((el) => {
        const heading = el
          .querySelector('#mp-detail-title')!
          .getBoundingClientRect();
        el.scrollTop += heading.bottom - el.getBoundingClientRect().top - 12;
      });
      await expect(title).not.toBeVisible();
    }
    await port.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(bar).toHaveAttribute('data-scrolled');
    await expect
      .poll(() => bar.evaluate((el) => getComputedStyle(el).backgroundColor))
      .not.toBe(restingFill);
    if (width >= 840) {
      await expect(title).toBeVisible();
      await expect(title).toHaveText(entries[0].title);
      const boxes = await dialog.locator('.mp-detail-bar').evaluate((el) => {
        const close = el
          .querySelector('.mp-detail-close')!
          .getBoundingClientRect();
        const title = el
          .querySelector('.mp-detail-toolbar-title')!
          .getBoundingClientRect();
        const actions = el
          .querySelector('.mp-detail-actions')!
          .getBoundingClientRect();
        return {
          closeRight: close.right,
          titleLeft: title.left,
          titleRight: title.right,
          actionsLeft: actions.left,
          width: title.width,
          overflow: el.scrollWidth > el.clientWidth,
        };
      });
      expect(boxes.closeRight + 8).toBeLessThanOrEqual(boxes.titleLeft);
      expect(boxes.titleRight + 8).toBeLessThanOrEqual(boxes.actionsLeft);
      expect(boxes.width).toBeGreaterThan(80);
      expect(boxes.overflow).toBe(false);
      const main = await dialog.locator('#mp-detail-title').boundingBox();
      const scroller = await port.boundingBox();
      expect(main!.y + main!.height).toBeLessThanOrEqual(scroller!.y);
    } else await expect(title).not.toBeVisible();
    const after = await dialog.locator('.mp-detail-pagination').boundingBox();
    expect(after).toEqual(before);
    await port.evaluate((el) => {
      el.scrollTop = 0;
    });
    await expect(title).not.toBeVisible();
    await expect(bar).not.toHaveAttribute('data-scrolled');
  }
  await port.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(title).toBeVisible();
  await dialog.getByRole('button', { name: 'Next playlist' }).click();
  await expect(title).toHaveText(entries[1].title);
  await expect(title).not.toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include('dialog.mp-detail').analyze())
      .violations
  ).toEqual([]);
});

test('enhancing the server-rendered detail preserves an existing reading position', async ({
  page,
}) => {
  await seedLongTrackList();
  let release!: () => void;
  const hydration = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\.js(?:\?|$)/, async (route) => {
    await hydration;
    await route.continue();
  });
  try {
    await page.goto(`/music?detail=${entries[0].id}`, { waitUntil: 'commit' });
    const dialog = page.locator('dialog.mp-detail');
    const port = dialog.locator('.mp-detail-scroll');
    await expect(dialog.locator('.mp-track-list > li')).toHaveCount(105);
    await page.evaluate(() =>
      Promise.all(Array.from(document.fonts, (face) => face.load()))
    );
    await port.focus();
    await port.press('End');
    await expect
      .poll(() =>
        port.evaluate((el) =>
          Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop)
        )
      )
      .toBeLessThanOrEqual(1);
    const before = await port.evaluate((el) => el.scrollTop);
    expect(before).toBeGreaterThan(1000);
    release();
    await expect(page.locator('dialog.mp-detail:modal')).toBeVisible();
    await expect(port).toBeFocused();
    await expect.poll(() => port.evaluate((el) => el.scrollTop)).toBe(before);
  } finally {
    release();
  }
});

test('opening motion keeps tracks visible immediately and honors reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/music');
  const supported = await page.evaluate(
    () =>
      typeof document.startViewTransition === 'function' &&
      CSS.supports('view-transition-group', 'contain')
  );
  if (!supported) {
    await page
      .getByRole('link', { name: `Open ${entries[0].title}`, exact: true })
      .click();
    await expect(page.locator('dialog.mp-detail')).toBeVisible();
    await expect(page.locator('.mp-track-list > li')).toHaveCount(12);
    await expect(page.locator('html')).not.toHaveAttribute('data-music-motion');
    return;
  }
  await page.evaluate(() => {
    const start = document.startViewTransition.bind(document);
    const state = window as typeof window & {
      musicMotionSample?: {
        opacity: string;
        name: string;
        delay: string;
        duration: string;
        surfaceClip: string;
        viewportClip: string;
        viewportGroup: string;
        surfaceBackground: string;
        ground: string;
      };
    };
    document.startViewTransition = (update) => {
      const transition = start(update);
      void transition.ready.then(() => {
        const root = document.documentElement;
        const tracks = getComputedStyle(
          root,
          '::view-transition-new(music-prototype-tracks)'
        );
        const cover = getComputedStyle(
          root,
          '::view-transition-group(music-prototype-cover)'
        );
        state.musicMotionSample = {
          opacity: tracks.opacity,
          name: tracks.animationName,
          delay: tracks.animationDelay,
          duration: cover.animationDuration,
          surfaceClip: getComputedStyle(
            root,
            '::view-transition-group-children(music-prototype-surface)'
          ).overflow,
          viewportClip: getComputedStyle(
            root,
            '::view-transition-group-children(music-prototype-viewport)'
          ).overflow,
          viewportGroup: getComputedStyle(
            document.querySelector('.mp-detail-scroll')!
          ).getPropertyValue('view-transition-group'),
          surfaceBackground: getComputedStyle(
            root,
            '::view-transition-new(music-prototype-surface)'
          ).backgroundColor,
          ground: getComputedStyle(document.querySelector('dialog.mp-detail')!)
            .backgroundColor,
        };
      });
      return transition;
    };
  });
  await page
    .getByRole('link', { name: `Open ${entries[0].title}`, exact: true })
    .click();
  const sample = () =>
    page.evaluate(
      () =>
        (
          window as typeof window & {
            musicMotionSample?: {
              opacity: string;
              name: string;
              delay: string;
              duration: string;
              surfaceClip: string;
              viewportClip: string;
              viewportGroup: string;
              surfaceBackground: string;
              ground: string;
            };
          }
        ).musicMotionSample
    );
  await expect.poll(sample).toBeTruthy();
  const value = (await sample())!;
  expect(value.opacity).toBe('1');
  expect(value.name).toBe('none');
  expect(value.delay).toBe('0s');
  expect(parseFloat(value.duration)).toBeGreaterThan(0);
  expect(parseFloat(value.duration)).toBeLessThanOrEqual(0.4);
  expect(value.surfaceClip).toBe('clip');
  expect(value.viewportClip).toBe('clip');
  expect(value.viewportGroup).toBe('contain');
  expect(value.surfaceBackground).toBe(value.ground);
  await expect(page.locator('html')).not.toHaveAttribute('data-music-motion');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/music');
  await page
    .getByRole('link', { name: `Open ${entries[0].title}`, exact: true })
    .click();
  await expect(page.locator('dialog.mp-detail')).toBeVisible();
  await expect(page.locator('html')).not.toHaveAttribute('data-music-motion');
});

test('arrow navigation preserves the detail container shape throughout its transition', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`/music?detail=${entries[0].id}`);
  const supported = await page.evaluate(
    () =>
      typeof document.startViewTransition === 'function' &&
      CSS.supports('view-transition-group', 'contain')
  );
  if (!supported) {
    const dialog = page.locator('dialog.mp-detail');
    const radius = await dialog.evaluate(
      (el) => getComputedStyle(el).borderRadius
    );
    const bounds = await dialog.boundingBox();
    for (const direction of ['Next playlist', 'Previous playlist']) {
      await page.getByRole('button', { name: direction, exact: true }).click();
      await expect(dialog).toHaveCSS('border-radius', radius);
      expect(await dialog.boundingBox()).toEqual(bounds);
    }
    await page.screenshot({ path: testInfo.outputPath('detail-shape.png') });
    return;
  }
  await page.evaluate(() => {
    const start = document.startViewTransition.bind(document);
    const state = window as typeof window & {
      swapShapes?: { radius: string; clip: string; expected: string }[];
    };
    state.swapShapes = [];
    document.startViewTransition = (update) => {
      const transition = start(update);
      void transition.ready.then(async () => {
        const root = document.documentElement;
        if (root.dataset.musicMotion !== 'swap') return;
        do {
          const surface = getComputedStyle(
            root,
            '::view-transition-image-pair(music-prototype-surface)'
          );
          state.swapShapes!.push({
            radius: surface.borderRadius,
            clip: surface.overflow,
            expected: getComputedStyle(document.querySelector('.mp-detail')!)
              .borderRadius,
          });
          await new Promise(requestAnimationFrame);
        } while (root.dataset.musicMotion === 'swap');
      });
      return transition;
    };
  });
  for (const direction of ['Next playlist', 'Previous playlist']) {
    await page.getByRole('button', { name: direction, exact: true }).click();
    await expect(page.locator('html')).not.toHaveAttribute('data-music-motion');
  }
  const samples = await page.evaluate(
    () =>
      (
        window as typeof window & {
          swapShapes: { radius: string; clip: string; expected: string }[];
        }
      ).swapShapes
  );
  expect(samples.length).toBeGreaterThan(1);
  for (const sample of samples) {
    expect(sample.radius).toBe(sample.expected);
    expect(sample.clip).toBe('clip');
  }
  await page.screenshot({ path: testInfo.outputPath('detail-shape.png') });
});

test('Music action controls use expressive pressed shapes while the panel stays fixed', async ({
  page,
}, testInfo) => {
  for (const motion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion: motion });
    await page.goto(`/music?detail=${entries[0].id}`);
    const dialog = page.locator('dialog.mp-detail');
    const panel = await dialog.boundingBox();
    const panelRadius = await dialog.evaluate(
      (el) => getComputedStyle(el).borderRadius
    );
    const next = page.getByRole('button', {
      name: 'Next playlist',
      exact: true,
    });
    for (const target of [
      page.getByRole('link', { name: 'Close playlist', exact: true }),
      next,
      page.getByRole('link', { name: 'Open in Spotify', exact: true }),
    ]) {
      const bounds = (await target.boundingBox())!;
      expect(bounds.width).toBeGreaterThanOrEqual(48);
      expect(bounds.height).toBeGreaterThanOrEqual(48);
      await page.mouse.move(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2
      );
      await page.mouse.down();
      await expect(target).toHaveCSS('border-radius', '8px');
      expect(await target.boundingBox()).toEqual(bounds);
      await expect(dialog).toHaveCSS('border-radius', panelRadius);
      expect(await dialog.boundingBox()).toEqual(panel);
      if (target === next && motion === 'no-preference')
        await page.screenshot({
          path: testInfo.outputPath('expressive-pressed.png'),
        });
      await page.mouse.move(5, 5);
      await page.mouse.up();
      await expect(dialog).toBeVisible();
    }
    await page.keyboard.press('Tab');
    await next.focus();
    await expect(next).toHaveCSS('outline-style', 'solid');
    await page.keyboard.down('Space');
    await expect(next).toHaveCSS('border-radius', '8px');
    await page.keyboard.up('Space');
    await expect(page.locator('html')).not.toHaveAttribute('data-music-motion');
    await expect(dialog).toHaveCSS('border-radius', panelRadius);
  }
});

test('track links and long metadata remain readable across compact and expanded layouts', async ({
  page,
}) => {
  await seedLongTrackList();
  await page.goto(`/music?detail=${entries[0].id}`);
  const dialog = page.locator('dialog.mp-detail');
  const rows = dialog.locator('.mp-track-list > li');
  await expect(rows.nth(0).getByRole('link')).toHaveAttribute(
    'href',
    /open.spotify.com\/track\//
  );
  await expect(rows.nth(1).getByRole('link')).toHaveCount(0);
  await expect(rows.nth(1)).toContainText('Unavailable');
  await expect(rows.nth(2).getByRole('link')).toHaveCount(0);
  await expect(rows.nth(2)).toContainText('Local file');
  for (const width of [320, 390, 600, 840, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const row = rows.nth(100);
    await row.scrollIntoViewIfNeeded();
    const geometry = await row.evaluate((element) => {
      const title = element.querySelector<HTMLElement>('.mp-track-title')!;
      const duration =
        element.querySelector<HTMLElement>('.mp-track-duration')!;
      const number = element.querySelector<HTMLElement>('.mp-track-number')!;
      const wraps = (node: HTMLElement) => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return (
          new Set(
            Array.from(range.getClientRects()).map((rect) =>
              Math.round(rect.top)
            )
          ).size > 1
        );
      };
      return {
        aligned:
          Math.abs(
            title.getBoundingClientRect().left -
              document
                .querySelector('#mp-track-list-heading')!
                .getBoundingClientRect().left
          ) < 0.1,
        overflow: element.scrollWidth > element.clientWidth,
        titleClipped:
          title.scrollHeight > title.clientHeight ||
          title.scrollWidth > title.clientWidth,
        durationWrapped: wraps(duration),
        numberWrapped: wraps(number),
      };
    });
    expect(geometry).toEqual({
      aligned: true,
      overflow: false,
      titleClipped: false,
      durationWrapped: false,
      numberWrapped: false,
    });
  }
  expect(
    (await new AxeBuilder({ page }).include('dialog.mp-detail').analyze())
      .violations
  ).toEqual([]);
});

test('all tracks and Spotify destinations work without JavaScript, with no inert filter', async ({
  browser,
  page,
}) => {
  await seedLongTrackList();
  const native = await browser.newContext({
    baseURL: process.env.STUDIO_TEST_ORIGIN,
    javaScriptEnabled: false,
    viewport: page.viewportSize()!,
  });
  try {
    const nativePage = await native.newPage();
    await nativePage.goto(`/music?detail=${entries[0].id}`);
    const dialog = nativePage.locator('dialog.mp-detail');
    await expect(dialog.locator('.mp-track-list > li')).toHaveCount(105);
    await expect(dialog.getByRole('searchbox')).toHaveCount(0);
    await dialog.locator('.mp-detail-scroll').evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await expect(dialog.locator('.mp-detail-toolbar-title')).not.toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Find a track' })
    ).toHaveCount(0);
    await expect(
      dialog.locator('.mp-track-list > li').nth(100).getByRole('link')
    ).toHaveAttribute('href', /open.spotify.com\/track\//);
  } finally {
    await native.close();
  }
});

test('secret palette phrases open the right public playlist even when site search fails', async ({
  page,
}) => {
  await page.route('**/pagefind/**', (route) => route.abort());
  await page.goto('/music');
  expect((await page.request.get('/studio/music')).status()).toBe(404);
  expect((await page.request.get('/api/studio/music/catalog')).status()).toBe(
    404
  );
  for (const entry of entries) {
    await page
      .locator('.site-topbar-search a, .site-topbar-search button')
      .first()
      .click();
    const input = page.getByRole('combobox');
    await input.fill(entry.alias);
    const option = page.getByRole('option').filter({ hasText: entry.title });
    await expect(option).toHaveCount(1);
    await input.press('Enter');
    await expect(page.locator('#mp-detail-title')).toHaveText(entry.title);
    await expect(page.locator('.mp-credits')).toHaveCount(
      entry.alias === 'roll credits' ? 1 : 0
    );
    await page
      .getByRole('link', { name: 'Close playlist', exact: true })
      .click();
  }
});

test('playlist details put Close first and group position with navigation', async ({
  page,
  browser,
}, info) => {
  await page.goto(`/music?detail=${entries[0].id}`);
  const dialog = page.locator('dialog.mp-detail');
  await expect(dialog).toBeVisible();
  const bar = dialog.locator('.mp-detail-bar');
  await expect(bar.locator('a, button').first()).toHaveAccessibleName(
    'Close playlist'
  );
  const position = bar.locator('.mp-detail-position');
  await expect(position).toHaveText('1 of 3');
  await expect(bar.locator('.mp-detail-close')).toHaveCSS(
    'border-radius',
    '50%'
  );
  await expect(bar.locator('.mp-detail-close')).toHaveCSS(
    'border-top-width',
    '2px'
  );
  const close = await bar
    .getByRole('link', { name: 'Close playlist' })
    .boundingBox();
  const count = await position.boundingBox();
  const navigation = await bar
    .getByRole('group', { name: 'Playlist navigation' })
    .boundingBox();
  const header = await bar.boundingBox();
  // Classic scrollbars reserve equal rails in the header and detail body.
  const inset = await bar.evaluate(
    (element) =>
      16 + ((element as HTMLElement).offsetWidth - element.clientWidth) / 2
  );
  expect(close!.x - header!.x).toBeCloseTo(inset, 0);
  expect(close!.x + close!.width).toBeLessThan(count!.x);
  expect(count!.x + count!.width).toBeLessThan(navigation!.x);
  expect(
    header!.x + header!.width - navigation!.x - navigation!.width
  ).toBeCloseTo(inset, 0);
  expect(close!.width).toBeGreaterThanOrEqual(48);
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await dialog
      .locator('h2')
      .evaluate((title) => title.scrollWidth <= title.clientWidth)
  ).toBe(true);
  await page.setViewportSize(viewport);
  await expect(
    bar.getByRole('button', { name: 'Previous playlist' })
  ).toBeDisabled();
  await bar.getByRole('button', { name: 'Next playlist' }).click();
  await expect(position).toHaveText('2 of 3');
  await expect(dialog.locator('#mp-detail-title')).toHaveText(entries[1].title);
  await expect(
    bar.getByRole('button', { name: 'Previous playlist' })
  ).toBeEnabled();
  await page.screenshot({
    path: info.outputPath('playlist-header.png'),
    fullPage: false,
  });
  await bar.getByRole('link', { name: 'Close playlist' }).click();
  await expect(dialog).toBeHidden();
  const native = await browser.newContext({
    baseURL: process.env.STUDIO_TEST_ORIGIN,
    javaScriptEnabled: false,
    viewport,
  });
  try {
    const nativePage = await native.newPage();
    await nativePage.goto(`/music?detail=${entries[0].id}`);
    await nativePage.getByRole('link', { name: 'Close playlist' }).click();
    await expect(nativePage.locator('dialog.mp-detail')).toBeHidden();
    await expect(nativePage.locator('.mp-card')).toHaveCount(3);
  } finally {
    await native.close();
  }
});

test('credits are optional, can pause, and stop immediately for reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/music');
  await page
    .getByRole('link', { name: `Open ${entries[1].title}`, exact: true })
    .click();
  const credits = page.locator('.mp-credits');
  const summary = credits.locator('summary');
  const reader = credits.locator('.mp-credits-reader');
  await expect(credits).not.toHaveAttribute('open', '');
  await summary.click();
  await expect(credits).toHaveAttribute('open', '');
  await expect(credits).not.toHaveAttribute('data-running', 'true');
  await expect(
    credits.getByText('Music supervision', { exact: true })
  ).toHaveCount(1);
  await expect(credits.locator('li')).toHaveCount(12);
  await expect(page.locator('.mp-track-list li')).toHaveCount(12);
  expect(
    (await new AxeBuilder({ page }).include('.mp-credits').analyze()).violations
  ).toEqual([]);
  await expect(page.locator('audio, video')).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await summary.click();
  await summary.click();
  await expect(credits).toHaveAttribute('data-running', 'true');
  await expect
    .poll(() => reader.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(10);
  await page.locator('.mp-detail-scroll').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(credits).not.toHaveAttribute('data-running', 'true');
  const offscreen = await reader.evaluate((el) => el.scrollTop);
  await page.waitForTimeout(200);
  expect(await reader.evaluate((el) => el.scrollTop)).toBeCloseTo(offscreen, 0);
  await reader.scrollIntoViewIfNeeded();
  await expect(credits).toHaveAttribute('data-running', 'true');
  await credits
    .getByRole('button', { name: 'Pause credits', exact: true })
    .click();
  const stopped = await reader.evaluate((el) => el.scrollTop);
  await page.waitForTimeout(200);
  expect(await reader.evaluate((el) => el.scrollTop)).toBeCloseTo(stopped, 0);
  await credits
    .getByRole('button', { name: 'Resume credits', exact: true })
    .click();
  await expect(credits).toHaveAttribute('data-running', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(credits).not.toHaveAttribute('data-running', 'true');
  await expect(credits.getByRole('button', { name: /credits/ })).toHaveCount(0);
  await summary.click();
  await expect(credits).not.toHaveAttribute('open', '');
});

test('native credits still open without scripts', async ({ browser, page }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: page.viewportSize()!,
    baseURL: process.env.STUDIO_TEST_ORIGIN,
  });
  try {
    const native = await context.newPage();
    await native.goto(`/music?detail=${entries[1].id}`);
    const credits = native.locator('.mp-credits');
    await credits.locator('summary').click();
    await expect(credits).toHaveAttribute('open', '');
    await expect(credits.locator('li')).toHaveCount(12);
    await expect(credits.getByRole('button')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('empty placeholder sits in the content column and centers its contents', async ({
  page,
}, info) => {
  await excludeAllApproved();
  await page.goto('/music');
  const placeholder = page.locator('.mp-public-placeholder');
  await expect(placeholder.getByRole('heading')).toHaveText(
    'No playlists to show right now.'
  );
  await expect(placeholder).not.toContainText(/\byour\b/i);
  const box = (await placeholder.boundingBox())!;
  const heading = (await page.locator('.mp-heading h1').boundingBox())!;
  if (page.viewportSize()!.width >= 840)
    expect(box.x).toBeGreaterThan(heading.x + heading.width);
  else expect(box.y).toBeGreaterThan(heading.y + heading.height);
  for (const selector of [
    '.mp-public-placeholder-icon',
    'h2',
    'p',
    '.mp-public-placeholder-link',
  ]) {
    const child = (await placeholder.locator(selector).boundingBox())!;
    expect(child.x + child.width / 2).toBeCloseTo(box.x + box.width / 2, 0);
  }
  await expect(
    placeholder.getByRole('link', { name: 'Explore playlists', exact: true })
  ).toHaveAttribute('href', /^https:\/\/open.spotify.com\/user\//);
  await page.screenshot({
    path: info.outputPath('music-empty.png'),
    fullPage: false,
  });
  await page
    .locator('.site-topbar-search a, .site-topbar-search button')
    .first()
    .click();
  await page.getByRole('combobox').fill('roll credits');
  await expect(
    page.getByRole('option').filter({ hasText: entries[1].title })
  ).toHaveCount(0);
});

test('approved playlists render on a normal visit without scripts or a selection', async ({
  browser,
  page,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: page.viewportSize()!,
    baseURL: process.env.STUDIO_TEST_ORIGIN,
  });
  try {
    const native = await context.newPage();
    await native.goto('/music');
    await expect(native.locator('.mp-card')).toHaveCount(entries.length);
    await expect(native.locator('.mp-card').first()).toBeVisible();
    for (const entry of entries)
      await expect(
        native.locator('.mp-card h3').filter({ hasText: entry.title })
      ).toHaveCount(1);
    await expect(native.locator('.mp-public-placeholder')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('fresh playlists stay visible while stale and newly suppressed cache rows stay hidden', async ({
  page,
}) => {
  await db.query('UPDATE music_approved_cache SET eligible=false WHERE id=$1', [
    entries[0].id,
  ]);
  await db.query(
    "UPDATE music_approved_cache SET checked_at=now()-interval '25 hours' WHERE id=$1",
    [entries[1].id]
  );
  await page.goto('/music');
  await expect(page.locator('.mp-card')).toHaveCount(1);
  await expect(page.locator('.mp-card h3')).toHaveText(entries[2].title);
  await expect(page.locator('.mp-public-placeholder')).toHaveCount(0);
});

for (const failure of ['missing', 'expired', 'expired body'] as const)
  test(`${failure} approved cache is unavailable rather than empty`, async ({
    page,
  }) => {
    if (failure === 'missing')
      await db.query('DELETE FROM music_approved_cache');
    else if (failure === 'expired')
      await db.query(
        "UPDATE music_approved_cache SET checked_at=now()-interval '25 hours'"
      );
    else
      await db.query(
        "UPDATE music_approved_cache SET body=jsonb_set(body, '{checkedAt}', to_jsonb((now()-interval '25 hours')::text))"
      );
    await page.goto('/music');
    await expect(page.locator('.mp-public-placeholder h2')).toHaveText(
      'Playlists are unavailable right now.'
    );
    await expect(
      page.getByRole('button', { name: 'Try again', exact: true })
    ).toBeVisible();
    await expect(page.locator('.mp-card')).toHaveCount(0);
  });

test('unavailable is distinct from empty and a native retry restores the collection', async ({
  browser,
  page,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: page.viewportSize()!,
    baseURL: process.env.STUDIO_TEST_ORIGIN,
  });
  const native = await context.newPage();
  try {
    const lock = await db.connect();
    await lock.query('BEGIN');
    await lock.query(
      'LOCK TABLE music_approved_cache IN ACCESS EXCLUSIVE MODE'
    );
    try {
      await native.goto('/music');
      const placeholder = native.locator('.mp-public-placeholder');
      await expect(placeholder.getByRole('heading')).toHaveText(
        'Playlists are unavailable right now.'
      );
      await expect(placeholder).toContainText(
        'The collection couldn’t be loaded.'
      );
      await expect(placeholder.locator('form')).toHaveAttribute(
        'action',
        '/music'
      );
      await expect(placeholder.locator('form')).toHaveAttribute(
        'method',
        'get'
      );
    } finally {
      await lock.query('ROLLBACK');
      lock.release();
    }
    await native
      .getByRole('button', { name: 'Try again', exact: true })
      .click();
    await expect(native.locator('.mp-card')).toHaveCount(3);
    await expect(native.locator('.mp-public-placeholder')).toHaveCount(0);
  } finally {
    await context.close();
  }
});
