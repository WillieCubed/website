import type { MetadataRoute } from 'next';

import { site } from '@/lib/site';

const ICON_SIZES = [48, 72, 96, 144, 192, 512];
const MASKABLE_ICON_SIZES = [192, 512];

/**
 * The web app manifest at /manifest.webmanifest. Its colors come from the
 * theme through `site`, so an installed app opens on the same surface the
 * page paints. A manifest takes one color per field, so both use the light
 * scheme; the viewport's theme-color meta tags still switch with the scheme.
 * The brand kit keeps its own copy at /brand/web/manifest.webmanifest.
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
