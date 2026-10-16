'use client';
import { type SyntheticEvent, useEffect, useRef, useState } from 'react';

import { useHydrated } from '@/lib/dom/hydrated';

export function usePlaylistCredits() {
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [visible, setVisible] = useState(true);
  const [inView, setInView] = useState(false);
  const reader = useRef<HTMLDivElement>(null);
  const enhanced = hydrated && typeof IntersectionObserver !== 'undefined';
  const running = enhanced && open && playing && !reduced && visible && inView;

  useEffect(() => {
    if (!open || !reader.current || !enhanced) return;
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    });
    observer.observe(reader.current);
    return () => observer.disconnect();
  }, [open, enhanced]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (media == null) return;
    const update = () => {
      setReduced(media.matches);
      if (media.matches) setPlaying(false);
    };
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    const element = reader.current;
    if (!running || !element) return;
    let frame: number;
    let previous: number | undefined;
    let position = element.scrollTop;
    const advance = (now: number) => {
      if (previous !== undefined)
        position += Math.min(now - previous, 64) * 0.028;
      previous = now;
      const end = element.scrollHeight - element.clientHeight;
      element.scrollTop = Math.min(position, end);
      if (position >= end) setPlaying(false);
      else frame = requestAnimationFrame(advance);
    };
    frame = requestAnimationFrame(advance);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  function onToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    const next = event.currentTarget.open;
    setOpen(next);
    setInView(false);
    if (next && reader.current) reader.current.scrollTop = 0;
    setPlaying(next && !reduced);
  }
  function togglePlayback() {
    if (!playing && reader.current) {
      const element = reader.current;
      if (element.scrollTop >= element.scrollHeight - element.clientHeight - 1)
        element.scrollTop = 0;
    }
    setPlaying(!playing);
  }
  return {
    reader,
    enhanced,
    reduced,
    playing,
    running,
    onToggle,
    togglePlayback,
    pause: () => setPlaying(false),
  };
}
