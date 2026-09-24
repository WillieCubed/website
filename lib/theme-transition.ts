export const THEME_TRANSITION_DURATION_MS = 520;

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
    if (chosen === 'light' || chosen === 'dark') root.dataset.theme = chosen;
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
