import Image from 'next/image';

type ImageSize = 'default' | 'wide' | 'full';

interface ImageWithCaptionProps {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  /**
   * Image size variant:
   * - 'default': constrained to text width
   * - 'wide': breaks out wider than text (emphasized)
   * - 'full': full bleed edge-to-edge
   */
  size?: ImageSize;
}

const sizeClasses: Record<ImageSize, string> = {
  default: '',
  wide: 'desktop:-mx-24 desktop:w-[calc(100%+12rem)]',
  full: '-mx-lg desktop:-mx-[calc((100vw-100%)/2)] w-screen desktop:w-screen max-w-none',
};

export default function ImageWithCaption({
  src,
  alt,
  caption,
  width = 800,
  height = 600,
  priority = false,
  size = 'default',
}: ImageWithCaptionProps) {
  const isFullBleed = size === 'full';

  return (
    <figure className={`my-8 ${sizeClasses[size]}`}>
      <div className={`overflow-hidden ${isFullBleed ? '' : 'rounded-lg'}`}>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          className="h-auto w-full object-cover"
        />
      </div>
      {caption && (
        <figcaption
          className={`mt-3 text-center text-body-small text-on-surface-variant ${
            isFullBleed ? 'px-lg' : ''
          }`}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
