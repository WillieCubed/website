/**
 * Which content column the page on screen uses, so the footer can line its
 * text up with it. The footer is rendered once, from the root layout, so it
 * cannot be told which page it sits under, and it cannot look: a client-side
 * navigation leaves the page before it in the document, hidden, still
 * carrying its own column. The top bar says so instead, for exactly as long
 * as it is on screen, and the footer and its lockup listen here.
 *
 * Next hides a page it navigates away from rather than unmounting it, which
 * runs the hidden page's effect cleanups, so a bar that has left the screen
 * has also left this list. The newest bar wins, because the page arriving
 * can register before the page leaving has let go.
 */

export type PageColumn = 'reading' | 'content' | 'wide';

interface Bar {
  column: PageColumn;
  element: Element;
}

let bars: Bar[] = [];
let heard = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Registers a top bar as on screen and returns the way to take it back. */
export function registerTopBar(column: PageColumn, element: Element) {
  const bar: Bar = { column, element };
  bars = [...bars, bar];
  heard = true;
  emit();
  return () => {
    bars = bars.filter((entry) => entry !== bar);
    emit();
  };
}

export function subscribeTopBar(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The top bar on screen, or null on a page without one. */
export function getTopBar(): Element | null {
  return bars.at(-1)?.element ?? null;
}

/**
 * The column of the page on screen. A page without a top bar, the homepage,
 * uses the wide one. Until any bar has spoken this is null: that is the
 * first page load before hydration, when the document holds only one page
 * and the stylesheet's own fallback can read the column from the markup.
 */
export function getPageColumn(): PageColumn | null {
  if (!heard) return null;
  return bars.at(-1)?.column ?? 'wide';
}

/** The server cannot know; the stylesheet's fallback draws the first paint. */
export function getPageColumnOnServer(): PageColumn | null {
  return null;
}

export function getTopBarOnServer(): Element | null {
  return null;
}
