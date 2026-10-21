import { visibleElement } from '@/lib/dom/visible';
import { footerProgress } from '@/lib/site/footer/dock';
import { createNameReveal, waveProgress } from '@/lib/site/footer/name-reveal';

function dockElements(footer: HTMLElement) {
  return {
    footer,
    root: document.documentElement,
    surface: document.querySelector<HTMLElement>('body > .grow'),
    contact: footer.querySelector<HTMLElement>('[data-footer-contact]'),
    row: footer.querySelector<HTMLElement>('.site-footer__row'),
    pages: footer.querySelector<HTMLElement>('.site-footer__pages'),
    rings: footer.querySelector<HTMLElement>('.site-webrings'),
    mark: footer.querySelector<HTMLElement>('.site-footer__mark-button'),
    feed: footer.querySelector<HTMLElement>('.feeds-button'),
    tagline: footer.querySelector<HTMLElement>(
      '.site-footer__brand-detail > p'
    ),
    extraProfiles: [...footer.querySelectorAll<HTMLElement>('[data-extra]')],
    headline: visibleElement('[data-footer-anchor]'),
  };
}
type DockElements = ReturnType<typeof dockElements>;

/** Measurements change on layout, while progress changes on every scroll frame. */
function dockGeometry({
  footer,
  root,
  surface,
  rings,
  row,
  contact,
}: DockElements) {
  let footerHeight = 0;
  let scrollHeight = 0;
  return {
    measure() {
      root.style.setProperty(
        '--page-w',
        String(document.body.getBoundingClientRect().width)
      );
      surface?.style.setProperty('--page-w', String(surface.offsetWidth));
      root.style.setProperty('--footer-row-h', `${row?.offsetHeight ?? 48}px`);
      root.style.setProperty(
        '--footer-contact-h',
        `${contact?.offsetHeight ?? 48}px`
      );
      footer.style.setProperty(
        '--footer-webrings-h',
        `${rings?.offsetHeight ?? 0}px`
      );
      footerHeight = footer.offsetHeight;
      scrollHeight = root.scrollHeight;
    },
    progress(keyboardDockOpen: boolean) {
      const flow = footerHeight > window.innerHeight;
      const p = keyboardDockOpen
        ? 1
        : flow
          ? Number(footer.getBoundingClientRect().top < window.innerHeight)
          : footerProgress({
              scrollY: window.scrollY,
              viewportHeight: window.innerHeight,
              scrollHeight,
              footerHeight,
            });
      return {
        flow,
        p,
        footerHeight,
        scrollRange: Math.max(0, scrollHeight - window.innerHeight),
      };
    },
  };
}

function setFocusAvailability(
  elements: DockElements,
  p: number,
  compact: boolean
) {
  const { footer, pages, rings, mark, feed, tagline, contact, extraProfiles } =
    elements;
  if (pages) pages.inert = p < 0.9;
  if (rings) rings.inert = p < 0.9;
  if (mark) mark.inert = compact && p < 0.08;
  if (feed) feed.inert = p < 0.6;
  const status = footer.querySelector<HTMLElement>('.microstatus');
  if (status) status.inert = p < 0.9;
  if (tagline) tagline.inert = p < 0.9;
  if (contact) contact.inert = compact && p < 0.08;
  extraProfiles.forEach((profile) => {
    profile.inert = !compact && p < 0.5;
  });
}

/** The same springs move the headline name out as the footer name arrives. */
function dockNames({ footer, headline }: DockElements, reduce: MediaQueryList) {
  const textIn = (element: Element | null | undefined) =>
    element?.firstChild instanceof Text ? element.firstChild : null;
  const footerText = textIn(footer.querySelector('[data-footer-name]'));
  const headlineText = textIn(headline?.firstElementChild ?? headline);
  const options = { reduceMotion: () => reduce.matches };
  const reveal = footerText ? createNameReveal(footerText, options) : null;
  const headlineReveal = headlineText
    ? createNameReveal(headlineText, options)
    : null;
  return {
    set(p: number, compact: boolean, footerHeight: number) {
      const box = compact ? null : (headline?.getBoundingClientRect() ?? null);
      const wave = waveProgress({ p, compact, headline: box, footerHeight });
      reveal?.set(wave);
      headlineReveal?.set(1 - wave);
    },
    destroy() {
      reveal?.destroy();
      headlineReveal?.destroy();
    },
  };
}

/** Only the homepage folds its contact row into the expanding footer. */
function dockPresentation(elements: DockElements, reduce: MediaQueryList) {
  elements.footer.dataset.dock = '';
  elements.root.dataset.footerDock = '';
  const names = dockNames(elements, reduce);
  return {
    paint(p: number, compact: boolean, height: number) {
      setFocusAvailability(elements, p, compact);
      names.set(p, compact, height);
    },
    destroy: () => names.destroy(),
  };
}

function paintDock(
  { footer, root }: DockElements,
  p: number,
  flow: boolean,
  footerHeight: number,
  scrollRange: number
) {
  footer.toggleAttribute('data-flow', flow);
  footer.style.setProperty('--p', p.toFixed(4));
  root.style.setProperty('--footer-p', p.toFixed(4));
  // Scaling creates a containing block for fixed elements: only scale a sheet.
  const sheet = flow
    ? 0
    : Math.min(
        p,
        window.scrollY / Math.max(1, Math.min(footerHeight, scrollRange))
      );
  root.style.setProperty('--sheet-p', sheet.toFixed(4));
  const stationary = scrollRange <= 1 && p > 0;
  root.toggleAttribute('data-footer-static', stationary);
  root.toggleAttribute('data-footer-sheet', sheet > 0 || stationary);
}

function resetDock(elements: DockElements) {
  const {
    footer,
    root,
    surface,
    pages,
    rings,
    mark,
    feed,
    tagline,
    contact,
    extraProfiles,
  } = elements;
  [
    pages,
    rings,
    mark,
    feed,
    footer.querySelector<HTMLElement>('.microstatus'),
    tagline,
    contact,
    ...extraProfiles,
  ].forEach((element) => {
    if (element) element.inert = false;
  });
  footer.removeAttribute('style');
  delete footer.dataset.dock;
  delete footer.dataset.flow;
  surface?.style.removeProperty('--page-w');
  root.style.removeProperty('--page-w');
  root.style.removeProperty('--footer-row-h');
  root.style.removeProperty('--footer-contact-h');
  root.style.removeProperty('--footer-p');
  root.style.removeProperty('--sheet-p');
  root.removeAttribute('data-footer-sheet');
  root.removeAttribute('data-footer-static');
  delete root.dataset.footerDock;
  delete root.dataset.footerMotion;
}

interface DockEvents {
  schedule: () => void;
  remeasure: () => void;
  keepOpen: () => void;
  onFocusOut: () => void;
  onKey: (event: KeyboardEvent) => void;
  release: () => void;
}

/** Registers and removes the entire dock's observers as one lifetime. */
function observeDock(
  footer: HTMLElement,
  compact: MediaQueryList,
  reduce: MediaQueryList,
  events: DockEvents
) {
  const { schedule, remeasure, keepOpen, onFocusOut, onKey, release } = events;
  const resize = new ResizeObserver(remeasure);
  resize.observe(document.body);
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', remeasure);
  compact.addEventListener('change', remeasure);
  reduce.addEventListener('change', remeasure);
  footer.addEventListener('focusin', keepOpen);
  footer.addEventListener('focusout', onFocusOut);
  document.addEventListener('keydown', onKey);
  window.addEventListener('wheel', release, { passive: true });
  window.addEventListener('touchstart', release, { passive: true });
  window.addEventListener('pointerdown', release, { passive: true });
  return () => {
    resize.disconnect();
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', remeasure);
    compact.removeEventListener('change', remeasure);
    reduce.removeEventListener('change', remeasure);
    footer.removeEventListener('focusin', keepOpen);
    footer.removeEventListener('focusout', onFocusOut);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('wheel', release);
    window.removeEventListener('touchstart', release);
    window.removeEventListener('pointerdown', release);
  };
}

/** One animation lifetime owns progress, keyboard pinning and frame scheduling. */
export function startFooterMotion(footer: HTMLElement, dockContacts: boolean) {
  const elements = dockElements(footer);
  const compact = window.matchMedia('(max-width: 839px)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const geometry = dockGeometry(elements);
  const dock = dockContacts ? dockPresentation(elements, reduce) : null;
  let p = 0;
  let keyboardDockOpen = false;
  let frame = 0;
  const update = () => {
    frame = 0;
    const progress = geometry.progress(keyboardDockOpen);
    p = progress.p;
    paintDock(
      elements,
      p,
      progress.flow,
      progress.footerHeight,
      progress.scrollRange
    );
    dock?.paint(p, compact.matches, progress.footerHeight);
  };
  const schedule = () => {
    if (frame === 0) frame = requestAnimationFrame(update);
  };
  const remeasure = () => {
    geometry.measure();
    schedule();
  };
  const keepOpen = () => {
    if (dock && p > 0.5) {
      keyboardDockOpen = true;
      schedule();
    }
  };
  const release = () => {
    keyboardDockOpen = false;
    schedule();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Tab' && footer.contains(document.activeElement))
      keepOpen();
  };
  const onFocusOut = () =>
    queueMicrotask(() => {
      if (!footer.contains(document.activeElement)) release();
    });
  elements.root.dataset.footerMotion = '';
  const unobserve = observeDock(footer, compact, reduce, {
    schedule,
    remeasure,
    keepOpen,
    release,
    onKey,
    onFocusOut,
  });
  geometry.measure();
  update();
  return () => {
    cancelAnimationFrame(frame);
    unobserve();
    dock?.destroy();
    resetDock(elements);
  };
}
