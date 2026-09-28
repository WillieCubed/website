import { type Page, expect, test } from '@playwright/test';

import { skipUnlessPublished } from './published';

// components/site/SharedTitle.tsx and TopBar.tsx. React names the shared
// elements only while a navigation's view transition runs, so the test
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
    Object.assign(window, { __transitions: recorded });
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
  return page.evaluate(
    () => (window as unknown as { __transitions: Recorded[] }).__transitions
  );
}

/** Waits until the router has the destination, so one commit swaps pages. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
}

const TITLE = 'title-initiative-fall-tour-2026';

test('a homepage tile’s title morphs into the initiative’s heading and back', async ({
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

  // The top bar's name leads home, where the heading shrinks into the tile.
  await settle(page);
  await page
    .getByRole('banner')
    .getByRole('link', { name: 'Willie Chalmers III' })
    .click();
  await expect(page).toHaveURL('/');
  await expect.poll(async () => (await transitions(page)).length).toBe(2);
  const back = (await transitions(page))[1];
  expect(back.before).toContain(`SPAN:${TITLE}:title-large`);
  expect(back.after).toContain(`SPAN:${TITLE}:title-small`);
});

test('the top bar and an index card’s title move to the next page', async ({
  page,
  request,
}) => {
  await skipUnlessPublished(request, '/initiatives/twd');
  await recordTransitions(page);
  await page.goto('/initiatives');
  await settle(page);
  await page
    .getByRole('main')
    .getByRole('link', { name: 'The Willie Diaries' })
    .click();
  await expect(page).toHaveURL('/initiatives/twd');
  await expect
    .poll(async () => (await transitions(page)).at(-1)?.groups)
    .toContain('::view-transition-group(site-top-bar)');

  const [record] = await transitions(page);
  expect(record.before).toEqual(
    expect.arrayContaining([
      'HEADER:site-top-bar:top-bar',
      'SPAN:title-initiative-twd:title-small',
    ])
  );
  expect(record.after).toEqual(
    expect.arrayContaining([
      'HEADER:site-top-bar:top-bar',
      'SPAN:title-initiative-twd:title-large',
    ])
  );
  expect(record.groups).toContain(
    '::view-transition-group(title-initiative-twd)'
  );
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
    await page
      .getByRole('main')
      .getByRole('link', { name: 'The Willie Diaries' })
      .click();
    await expect(page).toHaveURL('/initiatives/twd');
    await expect
      .poll(async () => (await transitions(page)).at(-1)?.groups)
      .toBeDefined();
    const [record] = await transitions(page);
    expect(record.after).toContain('SPAN:title-initiative-twd:title-large');
    expect(record.running).toBe(0);
  });
});
