import withMDX from '@next/mdx';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com', 'cdn.dribbble.com', 'i.scdn.co'],
  },
  experimental: {
    mdxRs: true,
  },
};

export default withMDX()(nextConfig);
