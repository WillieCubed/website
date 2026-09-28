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
  '/:page(brand|search|writings|initiatives|500)',
  '/:section(writings|initiatives)/:slug((?!opengraph-image$)[^/.]+)',
  '/initiatives/:slug([^/.]+)/:part(part-\\d+)',
  '/writings/tags/:tag([^/.]+)',
];

/**
 * Headers sent with every response. `next.config.ts` serves them.
 *
 * X-Clacks-Overhead keeps a name moving through the network for as long as
 * there are servers, after Terry Pratchett's Going Postal.
 */
export const siteHeaders: HeaderRule[] = [
  {
    source: '/:path*',
    headers: [{ key: 'X-Clacks-Overhead', value: 'GNU Terry Pratchett' }],
  },
  ...PAGE_SOURCES.map((source) => ({
    source,
    headers: [{ key: 'Link', value: linkHeader(ENDPOINT_DISCOVERY_LINKS) }],
  })),
];
