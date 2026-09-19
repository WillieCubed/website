export const THEME_TRANSITION_DURATION_MS = 520;

export const themeTransitionScript = `(() => {
  const scheme = window.matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  let cleanupTimer;

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
