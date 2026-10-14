import type { MetadataRoute } from 'next';

import { site } from '@/lib/site/identity';

const ICON_SIZES = [48, 72, 96, 144, 192, 512];
const MASKABLE_ICON_SIZES = [192, 512];

/**
 * Return the app identity, icons, display mode, launch URL, and theme colors
 * used when installing the site. The downloadable brand kit carries a
 * separate manifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: site.name,
    short_name: site.shortName,
    description: site.shortDescription,
    lang: site.locale.replace('_', '-'),
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: site.themeColors.light,
    theme_color: site.themeColor,
    icons: [
      {
        src: '/brand/web/favicon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
        purpose: 'any',
      },
      ...ICON_SIZES.map((size) => ({
        src: `/brand/web/icon-${size}.png`,
        type: 'image/png',
        sizes: `${size}x${size}`,
        purpose: 'any' as const,
      })),
      ...MASKABLE_ICON_SIZES.map((size) => ({
        src: `/brand/web/icon-maskable-${size}.png`,
        type: 'image/png',
        sizes: `${size}x${size}`,
        purpose: 'maskable' as const,
      })),
      {
        src: '/brand/web/icon-monochrome-512.png',
        type: 'image/png',
        sizes: '512x512',
        purpose: 'monochrome',
      },
    ],
  };
}
