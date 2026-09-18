'use client';

import Image from 'next/image';
import { useState } from 'react';

interface LiteYouTubeProps {
  videoId: string;
  title: string;
  /** Override the poster; defaults to YouTube's highest-resolution thumbnail. */
  poster?: string;
  className?: string;
}

/**
 * A YouTube facade. It renders a poster and a play button, preconnects on
 * intent, and only loads the privacy-enhanced iframe once the visitor asks
 * for it, so a page with a trailer does not pay for YouTube's player on load.
 */
export default function LiteYouTube({
  videoId,
  title,
  poster,
  className = '',
}: LiteYouTubeProps) {
  const [playing, setPlaying] = useState(false);
  const [warmed, setWarmed] = useState(false);
  const posterSrc =
    poster ?? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

  const warm = () => {
    if (warmed) return;
    setWarmed(true);
    for (const href of [
      'https://www.youtube-nocookie.com',
      'https://www.google.com',
      'https://i.ytimg.com',
    ]) {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = href;
      document.head.append(link);
    }
  };

  if (playing) {
    return (
      <div
        className={`relative aspect-video w-full overflow-hidden rounded-2xl bg-ink ${className}`}
      >
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      </div>
    );
  }

  return (
    <div
      className={`group relative aspect-video w-full overflow-hidden rounded-2xl bg-ink ${className}`}
    >
      <Image
        src={posterSrc}
        alt=""
        fill
        sizes="(min-width: 840px) 840px, 100vw"
        className="object-cover transition-transform duration-700 ease-site group-hover:scale-[1.02]"
        priority={false}
        unoptimized={posterSrc.endsWith('.svg')}
      />
      <a
        href={`https://www.youtube.com/watch?v=${videoId}`}
        onPointerEnter={warm}
        onFocus={warm}
        onClick={(event) => {
          event.preventDefault();
          setPlaying(true);
        }}
        className="absolute inset-0 flex items-center justify-center text-ground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ground"
        aria-label={`Play ${title}`}
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ground/90 text-ink shadow-lg transition-transform duration-300 ease-site group-hover:scale-105 motion-reduce:transition-none">
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
        </span>
      </a>
    </div>
  );
}
