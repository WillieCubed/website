type MotionPart =
  | 'surface'
  | 'cover'
  | 'controls'
  | 'summary'
  | 'tracks'
  | 'context'
  | 'editor';
export type PlaylistMotionParts = Partial<
  Record<MotionPart, HTMLElement | null>
>;

export function playlistMotion(
  update: () => void,
  before: PlaylistMotionParts,
  after: () => PlaylistMotionParts,
  kind: 'open' | 'close' | 'swap'
): () => void {
  if (
    typeof document.startViewTransition !== 'function' ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    update();
    return () => {};
  }

  const named = new Set<HTMLElement>();
  const root = document.documentElement;
  let cleaned = false;
  const name = (parts: PlaylistMotionParts) => {
    for (const [part, element] of Object.entries(parts)) {
      if (kind === 'swap' && part === 'controls') continue;
      if (!element || !element.getBoundingClientRect().height) continue;
      element.style.viewTransitionName = `music-prototype-${part}`;
      named.add(element);
    }
  };
  const clearNames = () => {
    for (const element of named) element.style.viewTransitionName = '';
  };
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    clearNames();
    delete root.dataset.musicMotion;
  };

  root.dataset.musicMotion = kind;
  name(before);
  const transition = document.startViewTransition(() => {
    // Skipping a transition does not cancel its pending update callback.
    if (cleaned) return;
    clearNames();
    update();
    name(after());
  });
  void transition.ready.catch(() => undefined);
  void transition.finished.catch(() => undefined).finally(cleanup);
  return () => {
    transition.skipTransition();
    cleanup();
  };
}
