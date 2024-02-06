import withMDX from '@next/mdx';
import type { NextConfig } from 'next/types';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com', 'cdn.dribbble.com', 'i.scdn.co'],
  },
  experimental: {
    mdxRs: true,
  },
};

export default withMDX()(nextConfig);
