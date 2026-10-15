import withMDX from '@next/mdx';
import type { NextConfig } from 'next/types';

import { siteHeaders } from './lib/http/response-headers';
import { site } from './lib/site/identity';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The credits document's Last update line. Next inlines this into the bundle while
  // building, so a request long after still reads the build's own time.
  env: { SITE_BUILT_AT: new Date().toISOString() },
  async headers() {
    return siteHeaders.map((rule) => ({
      ...rule,
      headers:
        process.env.SITE_MODE === 'preview'
          ? rule.headers
              .filter((header) => header.key !== 'Link')
              .map((header) =>
                header.key === 'Referrer-Policy'
                  ? { ...header, value: 'no-referrer' }
                  : header
              )
          : rule.headers,
    }));
  },
  /**
   * Host redirects live here rather than in a dashboard so they are
   * versioned and work on any host that loads the configuration. Every hostname
   * below must also be attached to the deployment.
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
  cacheComponents: false,
  // @atcute/tid reads the clock through @atcute/time-ms, which loads a native
  // addon from a computed path. Turbopack cannot bundle that, so Node loads
  // the package, and with it time-ms, from node_modules instead.
  serverExternalPackages: ['@atcute/tid', 'esbuild'],
  // The compiler uses one build-time browser runtime, kept in private functions.
  outputFileTracingIncludes: {
    '/*': [
      './node_modules/.pnpm/pg-cloudflare@*/node_modules/pg-cloudflare/dist/index.js',
    ],
    '/music': ['./content/music/catalog.json'],
    '/api/music/**': ['./content/music/catalog.json'],
    '/api/studio/**': [
      './.studio/browser-runtime.js',
      './.github/pull_request_template.md',
      './content/music/catalog.json',
    ],
  },
  allowedDevOrigins: ['williecubed.localhost', '127.0.0.1'],
  images: {
    // The optimizer does not forward Access credentials to protected sources.
    // Let the authenticated browser request preview images directly.
    unoptimized: process.env.SITE_MODE === 'preview',
    // Bound Cloudflare Images transformations. Current content image sizes
    // top out at 1200px, so 2400px preserves a 2x source; fewer widths leave
    // room under Images Free's monthly allowance.
    deviceSizes: [640, 828, 1080, 1200, 1920, 2400],
    imageSizes: [32, 64, 96, 160, 256, 384],
    qualities: [75, 90],
  },
  experimental: {
    cpus: 2,
    mdxRs: true,
  },
};

export default withMDX()(nextConfig);
