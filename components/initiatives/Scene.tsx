import Image from 'next/image';
import type { PropsWithChildren } from 'react';

interface SceneProps {
  src: string;
  alt: string;
  /** Put the media on the right instead of the left on wide screens. */
  flip?: boolean;
  caption?: string;
}

/**
 * One beat of a part's story: a piece of media beside a few paragraphs.
 * Authors alternate `flip` to make the page read like a photo essay.
 */
export default function Scene({
  src,
  alt,
  flip = false,
  caption,
  children,
}: PropsWithChildren<SceneProps>) {
  return (
    <section
      className={`my-10 grid items-center gap-6 expanded:grid-cols-2 ${flip ? 'expanded:[&>figure]:order-2' : ''}`}
    >
      <figure className="m-0">
        <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-tray">
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(min-width: 840px) 50vw, 100vw"
            className="object-cover"
            unoptimized={src.endsWith('.svg')}
          />
        </div>
        {caption && (
          <figcaption className="mt-2 text-label-medium text-muted">
            {caption}
          </figcaption>
        )}
      </figure>
      <div className="initiative-prose text-body-large text-ink">
        {children}
      </div>
    </section>
  );
}
