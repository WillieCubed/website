import withMDX from '@next/mdx';
import type { NextConfig } from 'next/types';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  cacheComponents: true,
  allowedDevOrigins: ['williecubed.localhost'],
  images: {
    remotePatterns: [
      {
        hostname: 'lh3.googleusercontent.com',
      },
      {
        hostname: 'cdn.dribbble.com',
      },
      {
        hostname: 'i.scdn.co',
      },
      {
        hostname: 'picsum.photos',
      },
      {
        hostname: 'i.ytimg.com',
      },
    ],
  },
  experimental: {
    mdxRs: true,
  },
};

export default withMDX()(nextConfig);
