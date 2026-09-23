'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';

import { visibleElement } from '@/lib/dom/visible';
import {
  getPageColumn,
  getPageColumnOnServer,
  subscribeTopBar,
} from '@/lib/footer/column';
import { footerProgress } from '@/lib/footer/dock';
import {
  getFooterDocked,
  getFooterDockedOnServer,
  subscribeFooterDocked,
} from '@/lib/footer/docked';
import { createNameReveal, waveProgress } from '@/lib/footer/name-reveal';

import './footer-dock.css';

const COMPACT = '(max-width: 839px)';
const REDUCE = '(prefers-reduced-motion: reduce)';

/**
 * The footer element itself. On most pages it is a plain block. On the
 * homepage, which says so by rendering DockFooter, it is the rail's contact
 * row until the page ends and then opens into the full footer: this marks
 * it for footer-dock.css to draw and writes how far open it is as --p,
 * which the stylesheet derives everything else from. It also runs the
 * name's letter wave. On every page it carries the column the top bar
 * registered (lib/footer/column.ts), so its text lines up with the page's.
 *
 * Both the mark and the opening are client-side, so a visitor without
 * scripting gets the plain footer rather than one stuck shut.
 */
export default function FooterFrame({ children }: React.PropsWithChildren) {
  const ref = useRef<HTMLElement>(null);
  const docked = useSyncExternalStore(
    subscribeFooterDocked,
    getFooterDocked,
    getFooterDockedOnServer
  );
  const column = useSyncExternalStore(
    subscribeTopBar,
    getPageColumn,
    getPageColumnOnServer
  );

  useEffect(() => {
    const footer = ref.current;
    if (!docked || !footer) return;
    footer.dataset.dock = '';

    const contact = footer.querySelector<HTMLElement>('[data-footer-contact]');
    const name = footer.querySelector<HTMLElement>('[data-footer-name]');
    const compact = window.matchMedia(COMPACT);
    const reduce = window.matchMedia(REDUCE);
    const reduceMotion = () => reduce.matches;
    const textIn = (element: Element | null | undefined) =>
      element?.firstChild instanceof Text ? element.firstChild : null;
    const footerName = textIn(name);
    const reveal = footerName
      ? createNameReveal(footerName, { reduceMotion })
      : null;
    // The headline's name leaves the way the footer's arrives: the same
    // letters, the same springs, run backwards, so the name reads as
    // moving down the page rather than as two names fading past each
    // other. The anchor holds the heading's own copy of the name.
    const headline = visibleElement('[data-footer-anchor]');
    const headlineName = textIn(headline?.firstElementChild ?? headline);
    const headlineReveal = headlineName
      ? createNameReveal(headlineName, { reduceMotion })
      : null;

    // Neither of these changes with the scroll, so they are read when the
    // page changes shape instead of every frame.
    let footerHeight = 0;
    let scrollHeight = 0;
    let p = 0;
    const measure = () => {
      footerHeight = footer.offsetHeight;
      scrollHeight = document.documentElement.scrollHeight;
    };

    let frame = 0;
    const update = () => {
      frame = 0;
      p = footerProgress({
        scrollY: window.scrollY,
        viewportHeight: window.innerHeight,
        scrollHeight,
        footerHeight,
      });
      footer.style.setProperty('--p', p.toFixed(4));
      // The headline's name rides the sticky rail, so where it has got to
      // is the one thing worth measuring every frame.
      const box = compact.matches
        ? null
        : (headline?.getBoundingClientRect() ?? null);
      const wave = waveProgress({
        p,
        compact: compact.matches,
        headline: box,
        footerHeight,
      });
      reveal?.set(wave);
      headlineReveal?.set(1 - wave);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const remeasure = () => {
      measure();
      schedule();
    };

    // Tabbing into a part of the footer that is still closed goes to the end
    // of the page, where it is open, rather than to something clipped away.
    // The contact links are on screen from the start on a wide window.
    const onFocus = (event: FocusEvent) => {
      if (p >= 1) return;
      const target = event.target as Node;
      if (!compact.matches && contact?.contains(target)) return;
      window.scrollTo({ top: document.documentElement.scrollHeight });
    };

    // The page grows as images load and the tagline streams in, which
    // moves where the footer's stretch of scroll starts.
    const resize = new ResizeObserver(remeasure);
    resize.observe(document.body);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', remeasure);
    compact.addEventListener('change', remeasure);
    footer.addEventListener('focusin', onFocus);
    measure();
    update();

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', remeasure);
      compact.removeEventListener('change', remeasure);
      footer.removeEventListener('focusin', onFocus);
      reveal?.destroy();
      headlineReveal?.destroy();
      footer.removeAttribute('style');
      delete footer.dataset.dock;
    };
  }, [docked]);

  return (
    <footer ref={ref} className="site-footer" data-column={column ?? undefined}>
      {children}
    </footer>
  );
}
