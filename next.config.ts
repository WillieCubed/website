import withMDX from '@next/mdx';
import type { NextConfig } from 'next/types';

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
    ],
  },
  experimental: {
    mdxRs: true,
  },
};

export default withMDX()(nextConfig);
