export interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

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
];
