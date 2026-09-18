import Image from 'next/image';

import LiteYouTube from '@/components/media/LiteYouTube';

import type { Initiative } from '@/lib/initiatives';

/**
 * The trailer at the top of an initiative page. Before the video exists it
 * shows the cover with a "trailer coming soon" note rather than an empty
 * player, so the page never ships a broken embed.
 */
export default function TrailerBlock({
  initiative,
}: {
  initiative: Initiative;
}) {
  const { trailer, cover } = initiative;
  if (trailer?.youtubeId) {
    return (
      <LiteYouTube
        videoId={trailer.youtubeId}
        title={trailer.title}
        poster={trailer.poster?.src}
      />
    );
  }
  const poster = trailer?.poster ?? cover;
  if (!poster) return null;
  return (
    <figure className="relative m-0 aspect-video w-full overflow-hidden rounded-2xl bg-ink">
      <Image
        src={poster.src}
        alt={poster.alt}
        fill
        sizes="(min-width: 840px) 840px, 100vw"
        className="object-cover"
        priority
        unoptimized={poster.src.endsWith('.svg')}
      />
      {trailer && (
        <figcaption className="absolute bottom-4 left-4 rounded-full bg-ground/90 px-3 py-1 text-label-medium text-ink">
          {trailer.title}: coming soon
        </figcaption>
      )}
    </figure>
  );
}
