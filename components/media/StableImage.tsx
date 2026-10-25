import type { ImgHTMLAttributes } from 'react';

import { imageMetadata } from '@/lib/media/geometry';
import { localImageSources } from '@/lib/media/responsive';

/** Known dimensions retain their ratio; unknown media gets a bounded, contained slot. */
export default function StableImage({
  src,
  alt,
  width,
  height,
  style,
  sizes,
  ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
  const size = imageMetadata(
    typeof src === 'string' ? src : undefined,
    width,
    height
  );
  return (
    // eslint-disable-next-line @next/next/no-img-element -- Uploaded and remote media also need a native baseline.
    <img
      {...props}
      src={src}
      sizes={sizes}
      {...localImageSources(
        typeof src === 'string' ? src : undefined,
        size?.width,
        size?.height,
        sizes ?? '(max-width: 768px) 100vw, 768px'
      )}
      alt={alt}
      width={size?.width}
      height={size?.height}
      style={{
        width: '100%',
        height: 'auto',
        aspectRatio: size ? `${size.width} / ${size.height}` : '4 / 3',
        objectFit: 'contain',
        ...style,
      }}
    />
  );
}
