import { themeSchemes } from './theme';

export const THEME_TRANSITION_DURATION_MS = 520;

/** The browser toolbar's color for each scheme: the page's surface. */
export const THEME_COLORS = {
  light: themeSchemes.light.surface,
  dark: themeSchemes.dark.surface,
};

/**
 * Points the theme-color tags at a chosen scheme, or back at their own
 * system-matched colors for null. The tags are media-matched per scheme, so
 * a chosen one takes over both and the toolbar agrees with the page.
 */
export function applyThemeColor(scheme: 'light' | 'dark' | null): void {
  for (const meta of document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]'
  )) {
    meta.dataset.systemColor ??= meta.content;
    meta.content = scheme ? THEME_COLORS[scheme] : meta.dataset.systemColor;
  }
}

/**
 * Where a visitor's own choice of scheme is kept (lib/theme-preference.ts).
 * The script below reads it before first paint, so a chosen scheme never
 * flashes the system one first.
 */
export const THEME_STORAGE_KEY = 'theme';

export const themeTransitionScript = `(() => {
  const scheme = window.matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  let cleanupTimer;

  // A scheme the visitor picked in the command palette (theme-preference.ts)
  // wins over the system one, applied here so the page paints in it first.
  try {
    const chosen = window.localStorage.getItem('${THEME_STORAGE_KEY}');
    if (chosen === 'light' || chosen === 'dark') {
      root.dataset.theme = chosen;
      // The theme-color tags may follow this script in the head, so they
      // take the chosen color once the document has parsed.
      const colors = ${JSON.stringify(THEME_COLORS)};
      document.addEventListener('DOMContentLoaded', () => {
        for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
          meta.dataset.systemColor = meta.content;
          meta.content = colors[chosen];
        }
      });
    }
  } catch {}

  const clearTransition = () => {
    window.clearTimeout(cleanupTimer);
    delete root.dataset.themeTransition;
  };

  const transitionTheme = () => {
    if (reducedMotion.matches) {
      clearTransition();
      return;
    }

    root.dataset.themeTransition = '';
    window.clearTimeout(cleanupTimer);
    cleanupTimer = window.setTimeout(clearTransition, ${THEME_TRANSITION_DURATION_MS});
  };

  scheme.addEventListener('change', transitionTheme);
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) clearTransition();
  });
})();`;
