'use client';

import React, { useLayoutEffect, useRef } from 'react';

import { type PageColumn, registerTopBar } from '@/lib/footer/column';

interface TopBarFrameProps {
  column: PageColumn;
  breadcrumbKey: string;
  className: string;
  floatOnScroll?: boolean;
  /** Two or more crumbs after the name, which the CSS treats as compact until measured. */
  longTrail?: boolean;
  /** Which phones the CSS treats as collapsed until measured (TopBar). */
  deepTrail?: 'phone' | 'narrow';
}

/**
 * The top bar's own element. It tells the footer which column the page uses
 * for as long as it is on screen (lib/footer/column.ts), so nothing has to
 * work out from the markup which page is showing. A layout effect, so the
 * footer changes width in the same frame as the page rather than after it.
 */
export default function TopBarFrame({
  column,
  breadcrumbKey,
  className,
  floatOnScroll = false,
  longTrail = false,
  deepTrail,
  children,
}: React.PropsWithChildren<TopBarFrameProps>) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    return registerTopBar(column, ref.current);
  }, [column]);

  useLayoutEffect(() => {
    const rail = ref.current?.querySelector<HTMLElement>('.site-breadcrumbs');
    if (!rail) return;

    const header = rail.closest('header');
    if (!header) return;
    // Each step runs only when the one before it still overflows. The cube
    // stands in for the name and the crumbs draw closer together. Then the
    // ellipsis crumb takes the crumbs above the current page one at a time,
    // from the top, until the rest fit. The current page's label truncates
    // as the last resort. The rail never scrolls, since a scrolled rail moves
    // the cube off the page's text edge. Each attribute is set explicitly so
    // the measurement overrides the server's guess (site.css).
    const current = rail.querySelector<HTMLElement>(
      '.site-breadcrumbs__crumb:last-child .site-breadcrumb-menu__label'
    );
    // Crumbs and the ellipsis menu's links share a depth, so folding a crumb
    // also lists it in the menu.
    const foldable = [...header.querySelectorAll<HTMLElement>('[data-depth]')];
    const depth = rail.querySelectorAll('[data-depth]').length;
    // The current crumb shrinks rather than overflow the rail, so a
    // truncated label is how an overflow shows up.
    const overflows = () =>
      rail.scrollWidth > rail.clientWidth ||
      (current !== null && current.scrollWidth > current.clientWidth);
    const fold = (count: number) => {
      header.setAttribute('data-folded', String(count));
      for (const element of foldable) {
        element.toggleAttribute(
          'data-folded',
          Number(element.dataset.depth) < count
        );
      }
    };
    const fitTrail = () => {
      header.setAttribute('data-compact', 'false');
      fold(0);
      if (!overflows()) return;
      header.setAttribute('data-compact', 'true');
      for (let count = 1; count <= depth && overflows(); count++) fold(count);
    };
    fitTrail();
    // The rail's width follows the header, which can change without a
    // window resize, such as when the search trigger's width settles.
    const observer = new ResizeObserver(fitTrail);
    observer.observe(rail);
    void document.fonts.ready.then(fitTrail);

    return () => observer.disconnect();
  }, [breadcrumbKey]);

  useLayoutEffect(() => {
    if (!floatOnScroll || !ref.current) return;
    const header = ref.current;
    const update = () =>
      header.toggleAttribute('data-scrolled', window.scrollY > 8);
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('pageshow', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('pageshow', update);
      header.removeAttribute('data-scrolled');
    };
  }, [floatOnScroll]);

  return (
    <header
      ref={ref}
      data-column={column}
      data-long-trail={longTrail || undefined}
      data-deep-trail={deepTrail}
      className={className}
    >
      {children}
    </header>
  );
}
