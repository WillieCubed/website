import {
  THEME_STORAGE_KEY,
  THEME_TRANSITION_DURATION_MS,
  applyThemeColor,
} from './theme-transition';

export type Scheme = 'light' | 'dark';

function root(): HTMLElement {
  return document.documentElement;
}

// The readers below answer 'light' and false outside a browser, so code that
// lists commands can run under plain Node in tests.
const inBrowser = () => typeof window !== 'undefined';

/** The scheme the operating system asks for. */
export function systemScheme(): Scheme {
  return inBrowser() &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** The scheme the page shows now: the visitor's choice, else the system's. */
export function currentScheme(): Scheme {
  const chosen = inBrowser() ? root().dataset.theme : undefined;
  return chosen === 'light' || chosen === 'dark' ? chosen : systemScheme();
}

/** True while the visitor has picked a scheme over the system's. */
export function hasSchemeOverride(): boolean {
  return inBrowser() && root().dataset.theme !== undefined;
}

/**
 * Shows `scheme`, or follows the system again when it is null. Picking the
 * scheme the system already asks for also drops the override, so the site
 * goes back to following the system rather than pinning a choice that
 * changes nothing today. The change eases with the same transition the head
 * script uses when the system scheme flips.
 */
export function setScheme(scheme: Scheme | null): void {
  const next = scheme === systemScheme() ? null : scheme;
  const element = root();
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    element.dataset.themeTransition = '';
    window.setTimeout(() => {
      delete element.dataset.themeTransition;
    }, THEME_TRANSITION_DURATION_MS);
  }
  if (next) element.dataset.theme = next;
  else delete element.dataset.theme;
  applyThemeColor(next);
  try {
    if (next) window.localStorage.setItem(THEME_STORAGE_KEY, next);
    else window.localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // Storage can be off in a private window. The choice still holds for
    // this page; it just will not outlive it.
  }
}
