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
        protocol: 'https',
        hostname: 'cdn.dribbble.com',
      },
      {
        hostname: 'i.scdn.co',
      },
    ],
  },
  experimental: {
    mdxRs: true,
  },
};

export default withMDX()(nextConfig);
