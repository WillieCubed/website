'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';

import { visibleElement } from '@/lib/dom/visible';
import {
  getPageColumn,
  getPageColumnOnServer,
  subscribeTopBar,
} from '@/lib/site/footer/column';
import { footerProgress } from '@/lib/site/footer/dock';
import {
  getFooterDocked,
  getFooterDockedOnServer,
  subscribeFooterDocked,
} from '@/lib/site/footer/docked';
import { createNameReveal, waveProgress } from '@/lib/site/footer/name-reveal';

import './footer-dock.css';

const COMPACT = '(max-width: 839px)';
const REDUCE = '(prefers-reduced-motion: reduce)';

/**
 * The footer element itself. On most pages it is a plain block. On the
 * homepage, which enables the dock controller, it is the rail's contact
 * row until the page ends and then opens into the full footer: this marks
 * it for the stylesheet to draw and writes how far open it is as --p,
 * which the stylesheet derives everything else from. It also runs the
 * name's letter wave. On every page it carries the column the top bar
 * registered, so its text lines up with the page's.
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
    // Keep the server layout when the visitor has reached its footer.
    // Normal visits still get the complete scroll-driven dock.
    if (footer.getBoundingClientRect().top < window.innerHeight) return;
    footer.dataset.dock = '';

    const contact = footer.querySelector<HTMLElement>('[data-footer-contact]');
    const pages = footer.querySelector<HTMLElement>('.site-footer__pages');
    const rings = footer.querySelector<HTMLElement>('.site-webrings');
    const markButton = footer.querySelector<HTMLElement>(
      '.site-footer__mark-button'
    );
    const feedButton = footer.querySelector<HTMLElement>('.feeds-button');
    const tagline = footer.querySelector<HTMLElement>(
      '.site-footer__brand-detail > p'
    );
    const extraProfiles = footer.querySelectorAll<HTMLElement>('[data-extra]');
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
    let keyboardDockOpen = false;
    // The page above turns into a sheet as the footer opens
    // through the shared styles, so the root carries the progress too, with the
    // page's width as a plain number for the sheet's scale.
    const root = document.documentElement;
    const surface = document.querySelector<HTMLElement>('body > .grow');
    root.dataset.footerDock = '';
    const measure = () => {
      root.style.setProperty(
        '--page-w',
        String(document.body.getBoundingClientRect().width)
      );
      surface?.style.setProperty('--page-w', String(surface.offsetWidth));
      footer.style.setProperty(
        '--footer-webrings-h',
        `${rings?.offsetHeight ?? 0}px`
      );
      footerHeight = footer.offsetHeight;
      scrollHeight = document.documentElement.scrollHeight;
    };

    const updateFocusAvailability = () => {
      // A clipped or transparent control cannot receive keyboard focus.
      if (pages) pages.inert = p < 0.9;
      if (rings) rings.inert = p < 0.9;
      if (markButton) markButton.inert = compact.matches && p < 0.08;
      if (feedButton) feedButton.inert = p < 0.6;
      const status = footer.querySelector<HTMLElement>('.microstatus');
      if (status) status.inert = p < 0.9;
      if (tagline) tagline.inert = p < 0.9;
      if (contact) contact.inert = compact.matches && p < 0.08;
      extraProfiles.forEach((profile) => {
        profile.inert = !compact.matches && p < 0.5;
      });
    };

    let frame = 0;
    const update = () => {
      frame = 0;
      // A footer taller than the viewport scrolls in normal flow. Keep an
      // already-open dock available when keyboard focus scrolls a link.
      const flow = footerHeight > window.innerHeight;
      footer.toggleAttribute('data-flow', flow);
      p = keyboardDockOpen
        ? 1
        : flow
          ? Number(footer.getBoundingClientRect().top < window.innerHeight)
          : footerProgress({
              scrollY: window.scrollY,
              viewportHeight: window.innerHeight,
              scrollHeight,
              footerHeight,
            });
      updateFocusAvailability();
      footer.style.setProperty('--p', p.toFixed(4));
      root.style.setProperty('--footer-p', p.toFixed(4));
      // The page becomes a sheet only as far as the visitor has scrolled:
      // on a window tall enough to show part of the footer at the top, the
      // page stays flat until it moves. Scaling it makes it a containing
      // block for fixed elements, so it is scaled only while it is a sheet.
      const sheet = flow
        ? 0
        : Math.min(p, window.scrollY / Math.max(footerHeight, 1));
      root.style.setProperty('--sheet-p', sheet.toFixed(4));
      root.toggleAttribute('data-footer-sheet', sheet > 0);
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
    const keepOpen = () => {
      if (p > 0.5) {
        keyboardDockOpen = true;
        schedule();
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && footer.contains(document.activeElement))
        keepOpen();
    };
    const onFocusOut = () =>
      queueMicrotask(() => {
        if (!footer.contains(document.activeElement)) {
          keyboardDockOpen = false;
          schedule();
        }
      });
    const release = () => {
      keyboardDockOpen = false;
      schedule();
    };

    // The page grows as images load and the tagline streams in, which
    // moves where the footer's stretch of scroll starts.
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
    measure();
    update();

    return () => {
      cancelAnimationFrame(frame);
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
      [
        pages,
        rings,
        markButton,
        feedButton,
        footer.querySelector<HTMLElement>('.microstatus'),
        tagline,
        contact,
        ...extraProfiles,
      ].forEach((element) => {
        if (element) element.inert = false;
      });
      reveal?.destroy();
      headlineReveal?.destroy();
      footer.removeAttribute('style');
      delete footer.dataset.dock;
      delete footer.dataset.flow;
      surface?.style.removeProperty('--page-w');
      root.style.removeProperty('--page-w');
      root.style.removeProperty('--footer-p');
      root.style.removeProperty('--sheet-p');
      root.removeAttribute('data-footer-sheet');
      delete root.dataset.footerDock;
    };
  }, [docked]);

  return (
    <footer ref={ref} className="site-footer" data-column={column ?? undefined}>
      {children}
    </footer>
  );
}
