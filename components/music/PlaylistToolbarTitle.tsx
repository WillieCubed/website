'use client';

import { type RefObject, useEffect, useRef } from 'react';

interface Props {
  title: string;
  dialogRef: RefObject<HTMLDialogElement | null>;
}

/** Optional visual context; the full heading remains the single accessible title. */
export default function PlaylistToolbarTitle({ title, dialogRef }: Props) {
  const label = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const text = label.current;
    const scroller = dialogRef.current?.querySelector<HTMLElement>(
      '.music-detail-scroll'
    );
    const heading = dialogRef.current?.querySelector<HTMLElement>(
      '#music-detail-title'
    );
    if (!text || !scroller || !heading) return;
    const bar = text.closest('.music-detail-bar');
    const update = () => {
      bar?.toggleAttribute('data-scrolled', scroller.scrollTop > 0);
      const bounds = heading.getBoundingClientRect();
      text.toggleAttribute(
        'data-visible',
        bounds.height > 0 &&
          scroller.clientHeight > 0 &&
          bounds.bottom <= scroller.getBoundingClientRect().top
      );
    };
    // Also handles instant jumps past the heading, including keyboard End.
    scroller.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(update);
    observer?.observe(scroller);
    observer?.observe(heading);
    update();
    return () => {
      bar?.removeAttribute('data-scrolled');
      scroller.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [dialogRef]);

  return (
    <span
      ref={label}
      className="music-detail-toolbar-title"
      aria-hidden="true"
      title={title}
    >
      {title}
    </span>
  );
}
