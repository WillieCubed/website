/**
 * Whether the page on screen wants the footer to be its contact row until
 * the page ends. The footer is rendered once, from the root layout, so it
 * cannot be told which page it sits under; the homepage says so itself by
 * rendering DockFooter, and the footer listens here.
 *
 * This is a plain store rather than context because the footer is not
 * inside the page's React tree, and it is read with useSyncExternalStore,
 * so it never renders anything on the server.
 */

let docked = false;
const listeners = new Set<() => void>();

export function setFooterDocked(value: boolean): void {
  if (docked === value) return;
  docked = value;
  for (const listener of listeners) listener();
}

export function subscribeFooterDocked(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getFooterDocked(): boolean {
  return docked;
}

/** The server renders the plain footer; docking is a client-side change. */
export function getFooterDockedOnServer(): boolean {
  return false;
}
