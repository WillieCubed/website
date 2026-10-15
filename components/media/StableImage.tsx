import type { ImgHTMLAttributes } from 'react';

import { imageMetadata } from '@/lib/media/geometry';

/** Known dimensions retain their ratio; unknown media gets a bounded, contained slot. */
export default function StableImage({
  src,
  alt,
  width,
  height,
  style,
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
