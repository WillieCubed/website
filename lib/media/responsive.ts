import { getImageProps } from 'next/image';

/** Only public, dimensioned content uses the site's configured image optimizer. */
export function localImageSources(
  src: string | undefined,
  width: number | undefined,
  height: number | undefined,
  sizes: string
): { src?: string; srcSet?: string; sizes?: string } {
  if (
    !src?.startsWith('/assets/') ||
    !/\.(?:avif|jpe?g|png|webp)$/i.test(src) ||
    width === undefined ||
    height === undefined
  )
    return {};
  const { props } = getImageProps({ src, width, height, sizes, alt: '' });
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes };
}
