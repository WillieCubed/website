import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Willie Chalmers III',
    short_name: 'WillieCubed',
    description: 'Willie Chalmers III builds software for humans.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#3C84FC',
    icons: [
      {
        src: '/favicon.ico',
        sizes: '32x32',
        type: 'image/x-icon',
      },
    ],
    categories: ['productivity'],
  };
}
