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

/** Keep the poster and a usable source link throughout player startup. */
export default function LiteYouTube({
  videoId,
  title,
  poster,
  className = '',
}: LiteYouTubeProps) {
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!playing || loaded || failed) return;
    const timer = setTimeout(() => setFailed(true), 10_000);
    return () => clearTimeout(timer);
  }, [playing, loaded, failed]);
  const source = `https://www.youtube.com/watch?v=${videoId}`;
  const posterSrc =
    poster ?? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  return (
    <figure className={className}>
      <div
        className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-ink"
        aria-busy={playing && !loaded && !failed}
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
        {!playing && (
          <a
            href={source}
            onClick={(event) => {
              if (!isPlainClick(event)) return;
              event.preventDefault();
              setPlaying(true);
            }}
            className="absolute inset-0 flex items-center justify-center text-ground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ground"
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
        {playing && !failed && (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`absolute inset-0 h-full w-full border-0 ${loaded ? '' : 'opacity-0'}`}
          />
        )}
      </div>
      <figcaption>
        <span role="status">
          {failed
            ? 'The player could not open. '
            : playing && !loaded
              ? 'Opening player… '
              : ''}
        </span>
        <a href={source}>Watch {title} on YouTube</a>
        {failed && (
          <button
            type="button"
            onClick={() => {
              setLoaded(false);
              setFailed(false);
            }}
          >
            Try player again
          </button>
        )}
      </figcaption>
    </figure>
  );
}
