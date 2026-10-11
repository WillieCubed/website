import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const route = '/prototypes/music';

test.beforeEach(async ({ page }) => {
  await page.goto(route);
  await expect(
    page.getByRole('heading', { name: 'Music', exact: true })
  ).toBeVisible();
  await page.addStyleTag({ content: 'nextjs-portal { display: none; }' });
});

test('the gallery shows its lead once and preserves the selected series order', async ({
  page,
}) => {
  await expect(
    page.getByRole('article', { name: 'Featured playlist' })
  ).toHaveCount(1);
  await expect(
    page.getByRole('button', {
      name: 'Open Fall Tour 2026, Part 1',
      exact: true,
    })
  ).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'Open Loose ends', exact: true })
  ).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Playlist series' })
    .getByRole('button', { name: 'Fall Tour' })
    .click();
  expect(
    await page
      .locator('.mp-card')
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute('data-playlist'))
      )
  ).toEqual(['fall-1', 'fall-2', 'fall-3']);
  await expect(
    page.getByRole('article', { name: 'Featured playlist' })
  ).toHaveCount(0);
  await expect(page).toHaveURL(/series=fall-tour/);
  await expect(
    page.getByRole('button', { name: 'Fall Tour', pressed: true })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'All playlists', pressed: false })
  ).toBeVisible();
});

test('featuring is optional, explicit, and independent of series or search order', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Curate music', exact: true }).click();
  await page
    .getByRole('button', { name: 'Open Fall Tour 2026, Part 3', exact: true })
    .click();
  await page
    .getByRole('checkbox', { name: 'Feature in the gallery', exact: true })
    .check();
  await page
    .getByRole('button', { name: 'Close playlist', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Review changes', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Apply to prototype', exact: true })
    .click();
  await expect(
    page.getByRole('article', { name: 'Featured playlist' })
  ).toHaveAttribute('data-playlist', 'fall-3');
  await expect(page.locator('.mp-card').first()).toHaveAttribute(
    'data-playlist',
    'fall-3'
  );
  await expect(
    page.getByRole('button', {
      name: 'Open Fall Tour 2026, Part 3',
      exact: true,
    })
  ).toHaveCount(1);

  await page
    .getByRole('textbox', { name: 'Find a playlist' })
    .fill('Fall Tour');
  await expect(
    page.getByRole('article', { name: 'Featured playlist' })
  ).toHaveCount(0);
  expect(
    await page
      .locator('.mp-card')
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute('data-playlist'))
      )
  ).toEqual(['fall-1', 'fall-2', 'fall-3']);
  await page.getByRole('textbox', { name: 'Find a playlist' }).fill('');
  await page
    .getByRole('navigation', { name: 'Playlist series' })
    .getByRole('button', { name: 'Fall Tour' })
    .click();
  await expect(
    page.getByRole('article', { name: 'Featured playlist' })
  ).toHaveCount(0);
  expect(
    await page
      .locator('.mp-card')
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute('data-playlist'))
      )
  ).toEqual(['fall-1', 'fall-2', 'fall-3']);

  await page
    .getByRole('navigation', { name: 'Playlist series' })
    .getByRole('button', { name: 'All playlists' })
    .click();
  await page.getByRole('button', { name: 'Curate music', exact: true }).click();
  await page
    .getByRole('button', { name: 'Open Fall Tour 2026, Part 3', exact: true })
    .click();
  await page
    .getByRole('checkbox', { name: 'Feature in the gallery', exact: true })
    .uncheck();
  await page
    .getByRole('button', { name: 'Close playlist', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Review changes', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Apply to prototype', exact: true })
    .click();
  await expect(
    page.getByRole('article', { name: 'Featured playlist' })
  ).toHaveCount(0);
  await expect(page.locator('.mp-card').first()).toHaveAttribute(
    'data-playlist',
    'fall-1'
  );
  await expect(page.locator('.mp-card')).toHaveCount(7);
});

test('focus views retain repeated tracks, unavailable positions, and browser history', async ({
  page,
}) => {
  const opener = page.getByRole('button', {
    name: 'Open Fall Tour 2026, Part 1',
    exact: true,
  });
  await opener.click();
  const dialog = page.getByRole('dialog', {
    name: 'Fall Tour 2026, Part 1',
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.mp-track-list > li')).toHaveCount(6);
  await expect(
    dialog.locator('.mp-track-title').filter({ hasText: /^Opening track$/ })
  ).toHaveCount(2);
  await expect(dialog.locator('.mp-track-list > li').nth(2)).toContainText(
    '03'
  );
  await expect(dialog.locator('.mp-track-list > li').nth(2)).toContainText(
    'Unavailable track'
  );
  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await page.goForward();
  await expect(dialog).toBeVisible();
  await page
    .getByRole('button', { name: 'Close playlist', exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
});

test('a direct focused link closes within the gallery', async ({ page }) => {
  await page.goto(`${route}?series=fall-tour&detail=fall-2`);
  await expect(
    page.getByRole('dialog', { name: 'Fall Tour 2026, Part 2', exact: true })
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.mp-detail')).not.toBeVisible();
  await expect(page).toHaveURL(
    `http://127.0.0.1:3137${route}?series=fall-tour`
  );
});

test('local drafts survive reload and affect the gallery only after review and apply', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Curate music', exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Include Loose ends', exact: true })
    .check();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Open Loose ends', exact: true })
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Curate music', exact: true }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Include Loose ends', exact: true })
  ).toBeChecked();
  await page
    .getByRole('button', { name: 'Open Loose ends', exact: true })
    .click();
  await page
    .getByRole('textbox', { name: 'Your notes', exact: true })
    .fill('An authored note from the prototype reviewer.');
  await page
    .getByRole('button', { name: 'Close playlist', exact: true })
    .click();
  await page.getByRole('button', { name: 'View gallery', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Open Loose ends', exact: true })
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Curate music', exact: true }).click();
  await page
    .getByRole('button', { name: 'Review changes', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Review your collection', exact: true })
  ).toBeVisible();
  await expect(page.locator('.mp-review')).toContainText(
    'An authored note from the prototype reviewer.'
  );
  expect(
    (await new AxeBuilder({ page }).include('dialog.mp-review').analyze())
      .violations
  ).toEqual([]);
  await page.screenshot({
    path: `.playwright-mcp/music/${test.info().project.name}-review.png`,
  });
  await page
    .getByRole('button', { name: 'Apply to prototype', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Open Loose ends', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Loose ends', exact: true })
  ).toContainText('An authored note from the prototype reviewer.');
});

test('the owner can create a series, assign a playlist, and reorder with buttons', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Curate music', exact: true }).click();
  await page.getByRole('button', { name: 'Create a series' }).click();
  await page
    .getByRole('textbox', { name: 'Series name', exact: true })
    .fill('New compilation');
  await page
    .getByRole('button', { name: 'Create series', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'New compilation', exact: true })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Browse all playlists', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Open Summer 2026', exact: true })
    .click();
  await page
    .getByRole('checkbox', { name: 'New compilation', exact: true })
    .check();
  await page
    .getByRole('button', { name: 'Close playlist', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Playlist series' })
    .getByRole('button', { name: 'Fall Tour' })
    .click();
  await page
    .getByRole('button', {
      name: 'Move Fall Tour 2026, Part 2 earlier',
      exact: true,
    })
    .click();
  expect(
    await page
      .locator('.mp-card')
      .evaluateAll((cards) =>
        cards.map((card) => card.getAttribute('data-playlist'))
      )
  ).toEqual(['fall-2', 'fall-1', 'fall-3']);
});

test('the gallery and focus view are accessible and produce review screenshots', async ({
  page,
}, testInfo) => {
  await page.evaluate(() => document.fonts.ready);
  expect(
    (await new AxeBuilder({ page }).include('.music-prototype').analyze())
      .violations
  ).toEqual([]);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    )
    .toBeLessThanOrEqual(0);
  await page.screenshot({
    path: `.playwright-mcp/music/${testInfo.project.name}-gallery.png`,
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Open Fall Tour 2026, Part 1', exact: true })
    .click();
  expect(
    (await new AxeBuilder({ page }).include('dialog.mp-detail').analyze())
      .violations
  ).toEqual([]);
  await page.screenshot({
    path: `.playwright-mcp/music/${testInfo.project.name}-focus.png`,
  });
  await page
    .getByRole('button', { name: 'Close playlist', exact: true })
    .click();
  await page.getByRole('button', { name: 'Curate music', exact: true }).click();
  await page.screenshot({
    path: `.playwright-mcp/music/${testInfo.project.name}-curation.png`,
    fullPage: true,
  });
});

test('search works on touch and keyboard focus remains inside the playlist', async ({
  page,
}) => {
  await expect(
    page.locator('header[data-column] .palette-trigger')
  ).toHaveCount(0);
  await expect(
    page.getByRole('textbox', { name: 'Find a playlist' })
  ).toHaveCount(1);
  await page.locator('.mp-search').click();
  const search = page.getByRole('textbox', { name: 'Find a playlist' });
  await expect(search).toBeFocused();
  await search.fill('not a playlist');
  await expect(
    page.getByText('No matching playlists', { exact: true })
  ).toBeVisible();
  await search.fill('Summer');
  await expect(page.locator('.mp-card')).toHaveCount(1);
  await page
    .getByRole('button', { name: 'Open Summer 2026', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Close playlist', exact: true })
    .focus();
  await page.keyboard.press('Tab');
  await expect
    .poll(() =>
      page.evaluate(() => !!document.activeElement?.closest('dialog'))
    )
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Open Summer 2026', exact: true })
  ).toBeFocused();
});

test('dragging changes the authored order without changing the live gallery', async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    'Touch users reorder with the verified earlier and later controls.'
  );
  await page.getByRole('button', { name: 'Curate music', exact: true }).click();
  await page
    .locator('[data-playlist="summer"]')
    .dragTo(page.locator('[data-playlist="fall-1"]'));
  await expect(page.locator('.mp-card').first()).toHaveAttribute(
    'data-playlist',
    'summer'
  );
  await page.getByRole('button', { name: 'View gallery', exact: true }).click();
  await expect(page.locator('.mp-card').first()).toHaveAttribute(
    'data-playlist',
    'fall-1'
  );
});

test('opening, advancing, and closing work with full motion enabled', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => {
    const audit = {
      records: [] as {
        surface: number[];
        cover: number[];
        summaryDelay: number;
        tracksDelay: number;
      }[],
      errors: [] as string[],
    };
    Object.assign(window, { musicMotionAudit: audit });
    const native = document.startViewTransition.bind(document);
    document.startViewTransition = (...args) => {
      const transition = native(...args);
      void transition.ready
        .then(() => {
          const effects = document
            .getAnimations()
            .map((animation) => animation.effect)
            .filter(
              (effect): effect is KeyframeEffect =>
                effect instanceof KeyframeEffect
            );
          const named = (name: string) =>
            effects.find(
              (effect) =>
                effect.pseudoElement ===
                `::view-transition-group(music-prototype-${name})`
            );
          const widths = (name: string) =>
            named(name)
              ?.getKeyframes()
              .map((frame) => parseFloat(String(frame.width))) ?? [];
          const delay = (name: string) =>
            effects
              .find(
                (effect) =>
                  effect.pseudoElement ===
                  `::view-transition-new(music-prototype-${name})`
              )
              ?.getTiming().delay ?? 0;
          audit.records.push({
            surface: widths('surface'),
            cover: widths('cover'),
            summaryDelay: delay('summary'),
            tracksDelay: delay('tracks'),
          });
        })
        .catch((error) => audit.errors.push(String(error)));
      return transition;
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const opener = page.getByRole('button', {
    name: 'Open Fall Tour 2026, Part 1',
    exact: true,
  });
  await opener.click();
  await expect(
    page.getByRole('dialog', { name: 'Fall Tour 2026, Part 1', exact: true })
  ).toBeVisible();
  const readAudit = () =>
    page.evaluate(
      () =>
        (
          window as typeof window & {
            musicMotionAudit: {
              records: {
                surface: number[];
                cover: number[];
                summaryDelay: number;
                tracksDelay: number;
              }[];
              errors: string[];
            };
          }
        ).musicMotionAudit
    );
  await expect.poll(async () => (await readAudit()).records.length).toBe(1);
  const opening = (await readAudit()).records[0];
  expect(opening.surface).toHaveLength(2);
  expect(opening.cover).toHaveLength(2);
  expect(opening.surface[0]).toBeCloseTo(opening.cover[0], 0);
  expect(opening.surface[1]).toBeGreaterThan(opening.surface[0]);
  expect(opening.cover[1]).toBeLessThan(opening.cover[0]);
  expect(opening.summaryDelay).toBeGreaterThan(0);
  expect(opening.tracksDelay).toBeGreaterThan(opening.summaryDelay);
  await page
    .getByRole('button', { name: 'Next playlist', exact: true })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Summer 2026', exact: true })
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Close playlist', exact: true })
    .click();
  await expect(page.locator('dialog.mp-detail')).not.toBeVisible();
  await expect(opener).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.dataset.musicMotion)
    )
    .toBeUndefined();
  expect((await readAudit()).errors).toEqual([]);
  expect(
    await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLElement>('[style]')].filter(
          (element) =>
            element.style.viewTransitionName.startsWith('music-prototype-')
        ).length
    )
  ).toBe(0);
  expect(errors).toEqual([]);
});

test('the first screen shows a collection preview or a working scroll cue', async ({
  page,
}) => {
  for (const [width, height] of [
    [320, 740],
    [390, 844],
    [600, 650],
    [840, 700],
    [1440, 700],
    [1920, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(() =>
        page.evaluate(() => {
          const next = document
            .querySelector('.mp-card:not(.mp-card-lead)')!
            .getBoundingClientRect();
          return (
            next.top + 56 <= (window.visualViewport?.height ?? innerHeight) ||
            !!document.querySelector('.mp-scroll-cue')
          );
        })
      )
      .toBe(true);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const cue = document.querySelector('.mp-scroll-cue');
          if (!cue) return true;
          const box = cue.getBoundingClientRect();
          const caption = document
            .querySelector('.mp-card-lead .mp-card-caption')!
            .getBoundingClientRect();
          return (
            box.right <= caption.left ||
            box.left >= caption.right ||
            box.bottom <= caption.top ||
            box.top >= caption.bottom
          );
        })
      )
      .toBe(true);
    if (width === 390) {
      await expect
        .poll(() =>
          page.evaluate(() => {
            const cue = document.querySelector('.mp-scroll-cue');
            return cue
              ? innerHeight - cue.getBoundingClientRect().bottom
              : null;
          })
        )
        .toBe(20);
    }
  }
  const cue = page.getByRole('button', { name: 'Scroll to more playlists' });
  await expect(cue).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include('.music-prototype').analyze())
      .violations
  ).toEqual([]);
  await page.screenshot({
    path: `.playwright-mcp/music/${test.info().project.name}-scroll-cue.png`,
  });
  await cue.click();
  await expect(cue).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Open Summer 2026', exact: true })
  ).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(32);
});

test('interrupted motion and unavailable view transitions leave the gallery usable', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const opener = page.getByRole('button', {
    name: 'Open Fall Tour 2026, Part 1',
    exact: true,
  });
  await opener.evaluate((button) => button.click());
  await expect(page.locator('dialog.mp-detail')).toBeVisible();
  await page.evaluate(() => {
    document
      .querySelector<HTMLButtonElement>('[aria-label="Next playlist"]')!
      .click();
    document
      .querySelector<HTMLButtonElement>('[aria-label="Close playlist"]')!
      .click();
  });
  await expect(page.locator('dialog.mp-detail')).not.toBeVisible();
  await expect(page).not.toHaveURL(/detail=/);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.dataset.musicMotion)
    )
    .toBeUndefined();
  await expect(
    page.locator('[data-playlist="fall-1"] .mp-art-frame')
  ).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(document, 'startViewTransition', {
      value: undefined,
      configurable: true,
    })
  );
  await opener.click();
  await expect(
    page.getByRole('dialog', { name: 'Fall Tour 2026, Part 1', exact: true })
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog.mp-detail')).not.toBeVisible();
  await expect(opener).toBeFocused();
  expect(errors).toEqual([]);
});

test('the compact gallery fits 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    )
    .toBeLessThanOrEqual(0);
  await page.getByRole('button', { name: 'Curate music', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
    )
    .toBeLessThanOrEqual(0);
});
