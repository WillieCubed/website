/**
 * A client-side navigation leaves the page before it in the document,
 * hidden, so a plain querySelector can find an element belonging to a page
 * nobody is looking at. These pick the one that is actually on screen.
 */

export function visibleElement<E extends Element>(selector: string): E | null {
  for (const element of document.querySelectorAll<E>(selector)) {
    if (element.getClientRects().length > 0) return element;
  }
  return null;
}
