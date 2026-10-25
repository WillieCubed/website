import { getImageProps } from 'next/image';

import { imageDimensions } from '@/lib/content/generated-content';

/** Only public, dimensioned content uses the site's configured image optimizer. */
export function localImageSources(
  src: string | undefined,
  width: number | undefined,
  height: number | undefined,
  sizes: string
): { src?: string; srcSet?: string; sizes?: string } {
  const image = imageDimensions[src ?? ''];
  if (!image?.immutableSrc || width === undefined || height === undefined)
    return {};
  const { props } = getImageProps({
    src: image.immutableSrc,
    overrideSrc: src,
    width,
    height,
    sizes,
    alt: '',
  });
  return {
    src: props.src,
    srcSet: props.srcSet,
    sizes: props.sizes,
  };
}
