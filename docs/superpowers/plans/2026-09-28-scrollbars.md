# Scrollbars Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Theme every scrollbar on the site and stop the page shifting when the detail view opens, per `docs/superpowers/specs/2026-09-28-scrollbars-design.md`.

**Architecture:** Two custom properties on `:root` hold the thumb colors, and `:root` draws the page scrollbar with them and reserves its gutter. A `.scroller` utility in `app/globals.css` makes an inner scroller thin, draws its thumb from the same properties, and darkens it on hover. The branded detail view overrides the two properties.

**Tech Stack:** CSS (`scrollbar-color`, `scrollbar-width`, `scrollbar-gutter`), Tailwind 4 globals, Playwright e2e.

## Global Constraints

- Standard scrollbar properties only; no `::-webkit-scrollbar` and no plugin.
- Page thumb: `outline` at 50% over a transparent track. Hover: full `outline`.
- Branded detail view: `primary` at 45%, full `primary` on hover.
- `scrollbar-gutter: stable` on `:root`.
- The studio product row and the writings filter chips keep `.no-scrollbar` / hidden scrollbars.

---

### Task 1: Themed scrollbars

**Files:**

- Modify: `app/globals.css` (drop `@plugin 'tailwind-scrollbar'`; add the `:root` rules and `.scroller` next to `.no-scrollbar`)
- Modify: `app/layout.tsx:139` (drop `scrollbar-w-8 scrollbar-track-surface-container`)
- Modify: `package.json`, `pnpm-lock.yaml` (`pnpm remove tailwind-scrollbar`)
- Modify: `components/home/DetailDialog.tsx` (`className="detail scroller"`)
- Modify: `components/home/home.css` (branded dialog sets `--scrollbar-thumb` and `--scrollbar-thumb-hover`)
- Modify: `components/palette/Palette.tsx` (`palette-list scroller`, `palette-readout scroller`)
- Modify: `components/palette/palette.css` (drop its own `scrollbar-width: thin`)
- Modify: `app/brand/page.tsx` (the wide lockup preview gets `scroller`)
- Test: `tests/e2e/scrollbars.spec.mts`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1280, height: 900 } });

const style = (selector: string, property: string) =>
  `getComputedStyle(document.querySelector(${JSON.stringify(selector)})).${property}`;

test('the page reserves its gutter and draws a themed thumb', async ({
  page,
}) => {
  await page.goto('/');
  expect(await page.evaluate(style('html', 'scrollbarGutter'))).toBe('stable');
  expect(await page.evaluate(style('html', 'scrollbarColor'))).not.toBe('auto');
});

test('the detail view scrolls with a thin bar in its venture colours', async ({
  page,
}) => {
  await page.goto('/?detail=transitmapper');
  const dialog = page.locator('dialog.detail');
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(style('dialog.detail', 'scrollbarWidth'))).toBe(
    'thin'
  );
  const root = await page.evaluate(style('html', 'scrollbarColor'));
  expect(
    await page.evaluate(style('dialog.detail', 'scrollbarColor'))
  ).not.toBe(root);
});

test('the command palette results scroll with a thin bar', async ({ page }) => {
  await page.goto('/');
  await page.locator('.palette-trigger').first().click();
  await expect(page.locator('.palette-list')).toBeVisible();
  expect(await page.evaluate(style('.palette-list', 'scrollbarWidth'))).toBe(
    'thin'
  );
  expect(
    await page.evaluate(style('.palette-list', 'scrollbarColor'))
  ).not.toBe('auto');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm build && pnpm exec playwright test --project=desktop tests/e2e/scrollbars.spec.mts`
Expected: the gutter test fails with `auto`, the palette test fails on `scrollbarColor` `auto`.

- [ ] **Step 3: Implement**

`app/globals.css`, beside `.no-scrollbar`:

```css
/* Scrollbars follow the theme (docs/superpowers/specs/2026-09-28-scrollbars-design.md).
   The stable gutter keeps the page's width when the detail view hides its
   scrollbar, so nothing jumps on systems that draw classic scrollbars. */
:root {
  --scrollbar-thumb: color-mix(in srgb, var(--color-outline) 50%, transparent);
  --scrollbar-thumb-hover: var(--color-outline);
  scrollbar-color: var(--scrollbar-thumb) transparent;
  scrollbar-gutter: stable;
}

/* An inner scroller: a thin bar that draws its thumb fully while the
   pointer is over it. It resolves the thumb itself, so a surface that sets
   the two properties, such as a branded detail view, tints its own bar. */
.scroller {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
  &:hover {
    scrollbar-color: var(--scrollbar-thumb-hover) transparent;
  }
}
```

`components/home/home.css`, in `dialog.detail[data-branded]`:

```css
--scrollbar-thumb: color-mix(in srgb, var(--b-primary) 45%, transparent);
--scrollbar-thumb-hover: var(--b-primary);
```

- [ ] **Step 4: Run the test, the full e2e suite, and `pnpm check`**

Run: `pnpm check && pnpm exec playwright test --workers=2`
Expected: all pass; 4 IndieWeb write tests skip without Postgres.

- [ ] **Step 5: Look at it with classic scrollbars**

Launch Chromium without `--hide-scrollbars` and screenshot the homepage, an open detail view (branded and not), and the command palette, in light and dark. Confirm `innerWidth - clientWidth` does not change when the detail view opens.

- [ ] **Step 6: Commit**

```bash
git commit -m "fix(theme): Theme scrollbars and stop the page shifting under the detail view"
```
