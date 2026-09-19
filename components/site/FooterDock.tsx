'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { footerProgress } from '@/lib/footer/dock';
import { createNameReveal, waveProgress } from '@/lib/footer/name-reveal';

import './footer-dock.css';

const COMPACT = '(max-width: 839px)';
const REDUCE = '(prefers-reduced-motion: reduce)';

/**
 * Whether the homepage is the page on screen. A soft navigation leaves the
 * page before it in the document, hidden, so the rail can still be found
 * from another route; only the page being shown takes up space. This stands
 * in for route information the footer does not have: it is rendered from
 * the root layout, so it cannot be told which page it sits under, and the
 * homepage is also the one route that sometimes has no rail at all (hiatus
 * mode). A parallel route slot for the footer would make both of those
 * server facts and retire this probe.
 */
function homeOnScreen(): boolean {
  for (const element of document.querySelectorAll('.home')) {
    if (element.getClientRects().length > 0) return true;
  }
  return false;
}

/**
 * On the homepage, opens the footer out of its contact row as the page ends.
 * It marks the footer for footer-dock.css to draw, then writes how far open
 * it is as --p; the stylesheet derives everything else from that. It also
 * runs the name's letter wave. On every other page it does nothing, and the
 * footer is the plain block it always was.
 */
export default function FooterDock() {
  const pathname = usePathname();

  // Set up again on every navigation, since only the homepage has a rail
  // for the footer to grow out of.
  useEffect(() => {
    if (pathname !== '/') return;
    const footer = document.querySelector<HTMLElement>('footer.site-footer');
    if (!footer || !homeOnScreen()) return;
    footer.dataset.dock = '';

    const contact = footer.querySelector<HTMLElement>('[data-footer-contact]');
    const anchor = document.querySelector<HTMLElement>('[data-footer-anchor]');
    const name = footer.querySelector<HTMLElement>('[data-footer-name]');
    const compact = window.matchMedia(COMPACT);
    const reduce = window.matchMedia(REDUCE);
    const reveal =
      name?.firstChild instanceof Text
        ? createNameReveal(name.firstChild, {
            reduceMotion: () => reduce.matches,
          })
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
      const headline = compact.matches
        ? null
        : (anchor?.getBoundingClientRect() ?? null);
      reveal?.set(
        waveProgress({ p, compact: compact.matches, headline, footerHeight })
      );
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
      footer.removeAttribute('style');
      delete footer.dataset.dock;
    };
  }, [pathname]);

  return null;
}
