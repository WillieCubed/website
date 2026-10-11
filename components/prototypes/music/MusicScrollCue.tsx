'use client';

import { type RefObject, useEffect, useState } from 'react';

import Icon from '@/components/icons/Icon';

export default function MusicScrollCue({
  gallery,
  collection,
}: {
  gallery: RefObject<HTMLDivElement | null>;
  collection: string;
}) {
  const [visible, setVisible] = useState(false);
  const [bottom, setBottom] = useState(20);
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    let explored = window.scrollY > 32;
    const next = gallery.current?.querySelector<HTMLElement>(
      '.mp-card:not(.mp-card-lead)'
    );
    const update = () => {
      if (!active) return;
      if (!next || explored) return setVisible(false);
      const box = next.getBoundingClientRect();
      const height = window.visualViewport?.height ?? innerHeight;
      const cover = gallery.current
        ?.querySelector<HTMLElement>('.mp-card-lead .mp-art-frame')
        ?.getBoundingClientRect();
      const caption = gallery.current
        ?.querySelector<HTMLElement>('.mp-card-lead .mp-card-caption')
        ?.getBoundingClientRect();
      const overlapsCaption =
        caption && caption.top < height - 20 && caption.bottom > height - 64;
      setLeft(cover ? cover.left + cover.width / 2 : null);
      setBottom(
        cover && innerWidth < 600 && overlapsCaption
          ? Math.max(20, height - cover.bottom + 12)
          : 20
      );
      setVisible(box.top + 56 > height);
    };
    const scroll = () => {
      if (window.scrollY > 32) explored = true;
      update();
    };
    update();
    void document.fonts.ready.then(update);
    const observer = new ResizeObserver(update);
    if (gallery.current) observer.observe(gallery.current);
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      active = false;
      observer.disconnect();
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [gallery, collection]);

  if (!visible) return null;
  return (
    <button
      className="mp-scroll-cue"
      style={{
        bottom: `max(${bottom}px, env(safe-area-inset-bottom))`,
        left: left ?? '50%',
      }}
      aria-label="Scroll to more playlists"
      onClick={() => {
        const next = gallery.current?.querySelector<HTMLElement>(
          '.mp-card:not(.mp-card-lead)'
        );
        next?.scrollIntoView({
          block: 'start',
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'instant'
            : 'smooth',
        });
        next
          ?.querySelector<HTMLButtonElement>('.mp-card-open')
          ?.focus({ preventScroll: true });
        setVisible(false);
      }}
    >
      More playlists
      <Icon name="chevron-down" size={18} />
    </button>
  );
}
