import withMDX from '@next/mdx';
import type { NextConfig } from 'next/types';

import { siteHeaders } from './lib/response-headers';
import { site } from './lib/site';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return siteHeaders;
  },
  /**
   * Host redirects live here rather than in a dashboard so they are
   * versioned and work on any host that runs next.config. Every hostname
   * below must also be attached to the deployment (docs/deploy.md).
   */
  async redirects() {
    const legacy = site.legacyHosts.map((host) => ({
      source: '/:path*',
      has: [{ type: 'host' as const, value: host }],
      destination: `${site.origin}/:path*`,
      permanent: true,
    }));
    // Alias hosts point at whatever is current, so they stay temporary.
    const aliases = Object.entries(site.aliasHosts).map(([host, path]) => ({
      source: '/:path*',
      has: [{ type: 'host' as const, value: host }],
      destination: `${site.origin}${path}`,
      permanent: false,
    }));
    return [...legacy, ...aliases];
  },
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
