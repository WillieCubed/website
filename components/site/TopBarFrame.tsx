'use client';

import React, { useLayoutEffect, useRef } from 'react';

import { type PageColumn, registerTopBar } from '@/lib/footer/column';

interface TopBarFrameProps {
  column: PageColumn;
  breadcrumbKey: string;
  className: string;
  floatOnScroll?: boolean;
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

    const revealCurrentCrumb = () => {
      if (
        window.matchMedia('(max-width: 639px)').matches &&
        rail.scrollWidth > rail.clientWidth
      ) {
        rail.scrollLeft = rail.scrollWidth;
      }
    };
    revealCurrentCrumb();
    window.addEventListener('resize', revealCurrentCrumb);
    void document.fonts.ready.then(revealCurrentCrumb);

    return () => window.removeEventListener('resize', revealCurrentCrumb);
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
    <header ref={ref} data-column={column} className={className}>
      {children}
    </header>
  );
}
