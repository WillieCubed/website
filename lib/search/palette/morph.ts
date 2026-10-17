// The palette's shared-element morph and its keyboard shortcut, kept apart
// from the provider's state.

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Runs a DOM change inside a same-document view transition, so named
 * elements morph between their old and new boxes. Without the API it just
 * applies, and under reduced motion the palette's own CSS crossfades instead.
 * A transition the browser abandons still runs the update, so its rejection
 * is swallowed rather than left to strand the palette half open.
 */
export function transition(update: () => void): Promise<void> {
  if (document.startViewTransition == null || reducedMotion()) {
    update();
    return Promise.resolve();
  }
  const started = document.startViewTransition(update);
  // An abandoned transition rejects ready as well as finished, and nothing
  // else awaits ready, so without this every abort is an unhandled rejection.
  started.ready.catch(() => undefined);
  return started.finished.catch(() => undefined);
}

/**
 * True when the element has a box inside the window. Next keeps the
 * previous page in the document with display: none after a soft
 * navigation, so a trigger that is merely in the DOM may not be on screen.
 */
export function inViewport(element: HTMLElement): boolean {
  if (element.getClientRects().length === 0) return false;
  const rect = element.getBoundingClientRect();
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

/**
 * True when a modal dialog other than the palette covers the element, such
 * as the homepage's detail view over the rail's trigger. The palette does
 * not grow out of, or shrink back into, something behind another modal.
 */
export function underModal(
  element: HTMLElement,
  palette: HTMLDialogElement
): boolean {
  return [...document.querySelectorAll('dialog:modal')].some(
    (modal) => modal !== palette && !modal.contains(element)
  );
}

export function morphTarget(
  source: HTMLElement | null,
  dialog: HTMLDialogElement,
  animate: boolean
): HTMLElement | null {
  return animate && source && inViewport(source) && !underModal(source, dialog)
    ? source
    : null;
}

/** True for ⌘K on Apple platforms and Ctrl+K elsewhere, with no other keys. */
export function isPaletteShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === 'k' &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  );
}
