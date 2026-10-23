import { type Page, expect, test } from '@playwright/test';

import { skipUnlessPublished } from '../../../support/browser/published.mts';

// React names shared titles and breadcrumbs only while a navigation's
// view transition runs, so the test
// wraps document.startViewTransition and records the names on the page it
// leaves (when the transition starts) and on the page it lands on (once
// React's update has run), plus the groups the browser animates.

interface Recorded {
  before: string[];
  after?: string[];
  groups?: string[];
  running?: number;
  root?: string;
}

declare global {
  interface Window {
    __transitions?: Recorded[];
  }
}

async function recordTransitions(page: Page) {
  await page.addInitScript(() => {
    const named = () =>
      [...document.querySelectorAll<HTMLElement>('*')]
        .filter((element) => element.style.viewTransitionName)
        .map(
          (element) =>
            `${element.tagName}:${element.style.viewTransitionName}:${element.style.viewTransitionClass}`
        );
    const recorded: Recorded[] = [];
    window.__transitions = recorded;
    const start = Document.prototype.startViewTransition;
    Document.prototype.startViewTransition = function (
      this: Document,
      arg?: ViewTransitionUpdateCallback | StartViewTransitionOptions
    ) {
      const record: Recorded = { before: named() };
      recorded.push(record);
      const options = typeof arg === 'function' ? { update: arg } : arg;
      const transition = start.call(this, {
        ...options,
        update: async () => {
          await options?.update?.();
          record.after = named();
        },
      });
      transition.ready
        .then(() => {
          const animations = document.getAnimations();
          record.groups = animations
            .map(
              (animation) => (animation.effect as KeyframeEffect)?.pseudoElement
            )
            .filter((pseudo): pseudo is string =>
              Boolean(pseudo?.startsWith('::view-transition-group('))
            );
          record.running = animations.filter(
            (animation) =>
              (animation.effect as KeyframeEffect)?.pseudoElement?.startsWith(
                '::view-transition-group('
              ) && animation.effect?.getComputedTiming().duration !== 0
          ).length;
          record.root = document.documentElement.style.viewTransitionName;
        })
        .catch(() => undefined);
      transition.finished.catch(() => undefined);
      return transition;
    };
  });
}

function transitions(page: Page): Promise<Recorded[]> {
  return page.evaluate(() => {
    if (!window.__transitions) {
      throw new Error('View transition recording was not initialized.');
    }
    return window.__transitions;
  });
}

/** Waits until the router has the destination, so one commit swaps pages. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
}

const TITLE = 'title-initiative-fall-tour-2026';

test('a homepage tile’s title morphs into its heading and Home returns to the top', async ({
  page,
  request,
}) => {
  await skipUnlessPublished(request, '/initiatives/fall-tour-2026');
  await recordTransitions(page);
  await page.goto('/');
  await settle(page);
  await page.locator('#initiative-fall-tour-2026 a.cover').click();
  await expect(page).toHaveURL('/initiatives/fall-tour-2026');
  await expect
    .poll(async () => (await transitions(page)).at(-1)?.groups)
    .toContain(`::view-transition-group(${TITLE})`);

  const [forward] = await transitions(page);
  // The tile's words carry the name on the homepage, the heading's on the
  // initiative page, and the page around them cuts rather than fading.
  expect(forward.before).toContain(`SPAN:${TITLE}:title-small`);
  expect(forward.after).toContain(`SPAN:${TITLE}:title-large`);
  expect(forward.root).toBe('none');

  // Home starts a fresh navigation at the top. The tile lies below that
  // viewport, so React must not capture an invisible return participant.
  await settle(page);
  await page
    .getByRole('banner')
    .getByRole('link', { name: 'Willie Chalmers III' })
    .click();
  await expect(page).toHaveURL('/');
  await expect
    .poll(async () => (await transitions(page))[1]?.groups)
    .toBeDefined();
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(
    await page
      .locator('#initiative-fall-tour-2026')
      .evaluate((tile) => tile.getBoundingClientRect().top > innerHeight)
  ).toBe(true);
  const back = (await transitions(page))[1];
  expect(back.before).toContain(`SPAN:${TITLE}:title-large`);
  expect(back.after).not.toContain(`SPAN:${TITLE}:title-small`);
  expect(back.groups).not.toContain(`::view-transition-group(${TITLE})`);
});

test('the top bar and an index card’s title move to the next page', async ({
  page,
  request,
}) => {
  await skipUnlessPublished(request, '/initiatives/twd');
  await recordTransitions(page);
  await page.goto('/initiatives');
  await settle(page);
  const link = page
    .getByRole('main')
    .getByRole('link', { name: 'The Willie Diaries' });
  // The stretched link covers its whole card, so scrolling the link can
  // leave the title below the viewport on a phone. Its new viewport also
  // starts route prefetching, which must settle before testing one commit.
  await link.locator('span.inline-block').scrollIntoViewIfNeeded();
  await settle(page);
  await expect(link.locator('span.inline-block')).toBeInViewport({ ratio: 1 });
  const headerInViewport = await page.getByRole('banner').evaluate((header) => {
    const rect = header.getBoundingClientRect();
    return rect.bottom >= 0 && rect.top <= innerHeight;
  });
  await link.locator('span.inline-block').click();
  await expect(page).toHaveURL('/initiatives/twd');
  await expect
    .poll(async () => (await transitions(page)).at(-1)?.groups)
    .toContain('::view-transition-group(title-initiative-twd)');

  const [record] = await transitions(page);
  expect(record.before).toContain('SPAN:title-initiative-twd:title-small');
  expect(record.after).toContain('SPAN:title-initiative-twd:title-large');
  if (headerInViewport) {
    expect(record.before).toContain('HEADER:site-top-bar:top-bar');
    expect(record.after).toContain('HEADER:site-top-bar:top-bar');
    expect(record.groups).toContain('::view-transition-group(site-top-bar)');
  } else {
    expect(record.before).not.toContain('HEADER:site-top-bar:top-bar');
    expect(record.groups).not.toContain(
      '::view-transition-group(site-top-bar)'
    );
  }
  expect(record.running).toBeGreaterThan(0);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the shared elements jump to their new places without moving', async ({
    page,
    request,
  }) => {
    await skipUnlessPublished(request, '/initiatives/twd');
    await recordTransitions(page);
    await page.goto('/initiatives');
    await settle(page);
    const link = page
      .getByRole('main')
      .getByRole('link', { name: 'The Willie Diaries' });
    await link.locator('span.inline-block').scrollIntoViewIfNeeded();
    await settle(page);
    await expect(link.locator('span.inline-block')).toBeInViewport({
      ratio: 1,
    });
    await link.locator('span.inline-block').click();
    await expect(page).toHaveURL('/initiatives/twd');
    await expect
      .poll(async () => (await transitions(page)).at(-1)?.groups)
      .toBeDefined();
    const [record] = await transitions(page);
    expect(record.after).toContain('SPAN:title-initiative-twd:title-large');
    expect(record.running).toBe(0);
  });
});
