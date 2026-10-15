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
