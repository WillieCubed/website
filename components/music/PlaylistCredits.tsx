'use client';

import { useEffect, useRef, useState } from 'react';

import Icon from '@/components/icons/Icon';
import Button from '@/components/site/Button';

import { useHydrated } from '@/lib/dom/hydrated';
import type { MusicTrack } from '@/lib/music/types';

import './playlist-credits.css';

/** Native liner notes first; scrolling is an optional, interruptible enhancement. */
export default function PlaylistCredits({ tracks }: { tracks: MusicTrack[] }) {
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
    if (!media) return;
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

  const pause = () => setPlaying(false);
  return (
    <details
      className="mp-credits"
      data-running={running || undefined}
      onToggle={(event) => {
        const next = event.currentTarget.open;
        setOpen(next);
        setInView(false);
        if (next && reader.current) reader.current.scrollTop = 0;
        setPlaying(next && !reduced);
      }}
    >
      <summary>
        Roll credits
        <Icon name="chevron-down" size={16} />
      </summary>
      <div className="mp-credits-controls">
        <p>Scroll to read the credits.</p>
        {enhanced && !reduced && (
          <Button
            variant="quiet"
            aria-label={playing ? 'Pause credits' : 'Resume credits'}
            onClick={() => {
              if (!playing && reader.current) {
                const element = reader.current;
                if (
                  element.scrollTop >=
                  element.scrollHeight - element.clientHeight - 1
                )
                  element.scrollTop = 0;
              }
              setPlaying(!playing);
            }}
          >
            {playing ? 'Pause' : 'Roll'}
          </Button>
        )}
      </div>
      <div
        ref={reader}
        className="mp-credits-reader scroller"
        role="region"
        aria-label="Film credits, original track order"
        tabIndex={0}
        onWheel={pause}
        onTouchStart={pause}
        onPointerDown={pause}
        onKeyDown={pause}
        onFocus={pause}
      >
        <div className="mp-credits-intro">
          <p>Closing music</p>
          <h3>A soundtrack for the ending.</h3>
        </div>
        <ol role="list">
          {tracks.map((track, index) => (
            <li key={index}>
              <span className="mp-credits-song">{track.title}</span>
              <span className="mp-credits-artist">
                {track.artist || 'Artist unavailable'}
              </span>
            </li>
          ))}
        </ol>
        <div className="mp-credits-finale">
          <p>Music supervision</p>
          <h3>Willie Chalmers III</h3>
          <p>The end.</p>
        </div>
      </div>
    </details>
  );
}
