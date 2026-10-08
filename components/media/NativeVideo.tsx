'use client';

import type Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';

import SiteLink from '@/components/link/SiteLink';

interface NativeVideoProps {
  src: string;
  poster?: string;
  description?: string;
  sourceUrl?: string;
  className?: string;
}

/** Bluesky serves HLS; browsers without native HLS still keep native controls. */
export default function NativeVideo({
  src,
  poster,
  description,
  sourceUrl,
  className,
}: NativeVideoProps) {
  const video = useRef<HTMLVideoElement>(null);
  const [failedSource, setFailedSource] = useState<string>();
  const failed = failedSource === src;
  useEffect(() => {
    const element = video.current;
    if (
      !element ||
      !new URL(src).pathname.endsWith('.m3u8') ||
      element.canPlayType('application/vnd.apple.mpegurl')
    )
      return;
    let player: Hls | undefined;
    let disposed = false;
    let requestedPlay = !element.paused;
    const start = () => {
      requestedPlay = true;
      player?.startLoad();
    };
    element.addEventListener('play', start);
    void import('hls.js')
      .then(({ default: Hls }) => {
        if (disposed) return;
        if (!Hls.isSupported()) {
          setFailedSource(src);
          return;
        }
        player = new Hls({
          autoStartLoad: false,
          maxBufferLength: 15,
          capLevelToPlayerSize: true,
        });
        player.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setFailedSource(src);
            player?.destroy();
          }
        });
        player.on(Hls.Events.MANIFEST_PARSED, () => {
          if (requestedPlay && !disposed) player?.startLoad();
        });
        player.attachMedia(element);
        player.loadSource(src);
      })
      .catch(() => {
        if (!disposed) setFailedSource(src);
      });
    return () => {
      disposed = true;
      element.removeEventListener('play', start);
      player?.destroy();
    };
  }, [src]);
  return (
    <div>
      <video
        ref={video}
        onError={() => {
          const element = video.current;
          if (
            !new URL(src).pathname.endsWith('.m3u8') ||
            element?.canPlayType('application/vnd.apple.mpegurl')
          )
            setFailedSource(src);
        }}
        src={src}
        poster={poster}
        controls
        preload="none"
        playsInline
        className={className}
        aria-label={description || 'Video'}
      />
      {failed && sourceUrl && (
        <SiteLink
          href={sourceUrl}
          className="mt-2 inline-flex min-h-10 items-center rounded-full bg-tray px-4 text-label-medium text-ink"
        >
          Open video
        </SiteLink>
      )}
    </div>
  );
}
