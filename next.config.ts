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
    // Retired pages point at their nearest replacement. Temporary while
    // /projects is rebuilt, so the targets can still change.
    const retired = [
      { source: '/media', destination: '/initiatives/twd', permanent: false },
      { source: '/apps', destination: '/projects', permanent: false },
    ];
    // Paths feed readers guess when they cannot find an autodiscovery link.
    const feedGuesses = [
      { source: '/rss.xml', destination: '/feed.xml', permanent: true },
      { source: '/rss', destination: '/feed.xml', permanent: true },
      { source: '/feed', destination: '/feed.xml', permanent: true },
      { source: '/index.xml', destination: '/feed.xml', permanent: true },
      { source: '/atom.xml', destination: '/feed/atom', permanent: true },
    ];
    return [...legacy, ...aliases, ...retired, ...feedGuesses];
  },
  cacheComponents: true,
  allowedDevOrigins: ['williecubed.localhost'],
  images: {
    remotePatterns: [
      {
        hostname: 'i.ytimg.com',
      },
    ],
  },
  experimental: {
    cpus: 2,
    mdxRs: true,
  },
};

export default withMDX()(nextConfig);
