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
    // The cube stands in for the name when the trail would not fit, so the
    // current page stays readable without scrolling. Scrolling is the last
    // resort for a trail too long even then. Both values are set explicitly
    // so the measurement can override the server's guess (site.css).
    const revealCurrentCrumb = () => {
      header.setAttribute('data-compact', 'false');
      header.setAttribute(
        'data-compact',
        String(rail.scrollWidth > rail.clientWidth)
      );
      if (
        window.matchMedia('(max-width: 639px)').matches &&
        rail.scrollWidth > rail.clientWidth
      ) {
        rail.scrollLeft = rail.scrollWidth;
      }
    };
    revealCurrentCrumb();
    // The rail's width follows the header, which can change without a
    // window resize, such as when the search trigger's width settles.
    const observer = new ResizeObserver(revealCurrentCrumb);
    observer.observe(rail);
    void document.fonts.ready.then(revealCurrentCrumb);

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
      className={className}
    >
      {children}
    </header>
  );
}
