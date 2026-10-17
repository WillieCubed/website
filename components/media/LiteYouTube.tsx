'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

import { isPlainClick } from '@/lib/dom/click';

interface LiteYouTubeProps {
  videoId: string;
  title: string;
  poster?: string;
  className?: string;
}

type PlayerState = 'poster' | 'loading' | 'ready' | 'failed';
const playerMessage: Record<PlayerState, string> = {
  poster: '',
  loading: 'Opening player… ',
  ready: '',
  failed: 'The player could not open. ',
};

/** Keep the poster and a usable source link throughout player startup. */
export default function LiteYouTube({
  videoId,
  title,
  poster,
  className = '',
}: LiteYouTubeProps) {
  const [state, setState] = useState<PlayerState>('poster');
  useEffect(() => {
    if (state !== 'loading') return;
    const timer = setTimeout(() => setState('failed'), 10_000);
    return () => clearTimeout(timer);
  }, [state]);
  const source = `https://www.youtube.com/watch?v=${videoId}`;
  const posterSrc =
    poster ?? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  return (
    <figure className={className}>
      <div
        className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-ink"
        aria-busy={state === 'loading'}
      >
        <Image
          src={posterSrc}
          alt=""
          aria-hidden="true"
          fill
          sizes="(min-width: 840px) 840px, 100vw"
          className="object-cover"
          unoptimized={
            posterSrc.startsWith('https://') || posterSrc.endsWith('.svg')
          }
        />
        {state === 'poster' && (
          <a
            href={source}
            onClick={(event) => {
              if (!isPlainClick(event)) return;
              event.preventDefault();
              setState('loading');
            }}
            className="absolute inset-0 flex items-center justify-center text-ground focus-visible:outline-ground focus-visible:-outline-offset-6"
            aria-label={`Play ${title}`}
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ground/90 text-ink shadow-lg">
              <svg
                viewBox="0 0 24 24"
                width="28"
                height="28"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </span>
          </a>
        )}
        {(state === 'loading' || state === 'ready') && (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={() =>
              setState((current) => (current === 'loading' ? 'ready' : current))
            }
            onError={() => setState('failed')}
            className={`absolute inset-0 h-full w-full border-0 ${state === 'ready' ? '' : 'opacity-0'}`}
          />
        )}
      </div>
      <figcaption>
        <span role="status">{playerMessage[state]}</span>
        <a href={source}>Watch {title} on YouTube</a>
        {state === 'failed' && (
          <button
            type="button"
            className="site-control px-4 [--control-fill:var(--color-primary-container)] [--control-ink:var(--color-on-primary-container)]"
            onClick={() => {
              setState('loading');
            }}
          >
            Try player again
          </button>
        )}
      </figcaption>
    </figure>
  );
}
