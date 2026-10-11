// Relative for next.config.ts; see the note in discovery-links.ts.
import {
  ENDPOINT_DISCOVERY_LINKS,
  linkHeader,
} from './indieweb/discovery-links';

export interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

/**
 * The routes that answer with a page, as `headers()` sources. Everything
 * else under app/ is a route handler, a file, or an image, which a Link
 * header would only mislabel. A unit test walks app/ and fails when a page
 * is missing here or a route handler matches.
 */
export const PAGE_SOURCES = [
  '/',
  '/:page(about|research|projects|brand|search|writings|initiatives|media|sitemap|500)',
  '/:section(writings|initiatives|projects)/:slug((?!opengraph-image$)[^/.]+)',
  '/initiatives/:slug([^/.]+)/:part(part-\\d+)',
  '/writings/tags/:tag([^/.]+)',
];

/**
 * Headers sent with every response. `next.config.ts` serves them.
 *
 * X-Clacks-Overhead keeps a name moving through the network for as long as
 * there are servers, after Terry Pratchett's Going Postal.
 *
 * The rest close doors the site never opens. The referrer policy is the
 * browsers' own default, pinned so a host or a browser change cannot loosen
 * it. The permissions policy denies the camera, the microphone, location,
 * and interest-based ad cohorts (FLoC's interest-cohort and the Topics API
 * that replaced it) to every page and every embed on it; nothing asks for
 * them. There is no Content-Security-Policy (docs/protocols.md says why).
 */
export const siteHeaders: HeaderRule[] = [
  {
    source: '/:path*',
    headers: [
      { key: 'X-Clacks-Overhead', value: 'GNU Terry Pratchett' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      {
        key: 'Permissions-Policy',
        value:
          'camera=(), microphone=(), geolocation=(), interest-cohort=(), browsing-topics=()',
      },
    ],
  },
  // A header here replaces a route handler's own, and the IndieAuth consent
  // page sends the stricter no-referrer, so its routes are left out.
  {
    source: '/:path((?!indieauth/|atproto/|api/atproto/).*)',
    headers: [
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ],
  },
  ...PAGE_SOURCES.map((source) => ({
    source,
    headers: [
      { key: 'Link', value: linkHeader(ENDPOINT_DISCOVERY_LINKS) },
      // Pages only. The IndieAuth routes are route handlers and must never
      // get it: a client that opens sign-in in a popup reads window.opener
      // once the popup lands back on its redirect page.
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
    ],
  })),
];
