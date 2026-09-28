/**
 * Paths that are not pages, or that do something when fetched. A prefetch
 * of any of them is wasted at best: route handlers, feeds, protocol
 * endpoints, the IndieAuth flow, and anything with a file extension.
 */
export const SPECULATION_EXCLUDED_PATHS = [
  '/api/*',
  '/feed/*',
  '/activity/*',
  '/writings/feed/*',
  '/writings/*/activity/*',
  '/micropub{/*}?',
  '/webmention{s}?',
  '/indieauth/*',
  '/oembed',
  '/coffee',
  '/tea',
  '/whoami',
  '/.well-known/*',
  '/*.*',
];

/**
 * The page's speculation rules (https://developer.chrome.com/docs/web-platform/prerender-pages).
 *
 * They prefetch rather than prerender. SiteLink hands every in-site link
 * to Next's client router, which fetches its own RSC payload and never
 * uses a prerendered document, so a prerender would run a whole page and
 * its analytics for nothing. A prefetch is one HTML request, and it is
 * what a document navigation uses: a click before the page hydrates, a
 * visitor without scripts, or a navigation Next hands to the browser.
 * docs/protocols.md has the full reasoning.
 */
export const SPECULATION_RULES = {
  prefetch: [
    {
      source: 'document',
      where: {
        and: [
          { href_matches: '/*' },
          { not: { href_matches: SPECULATION_EXCLUDED_PATHS } },
          {
            not: {
              selector_matches:
                '[rel~="nofollow"], [target="_blank"], [download]',
            },
          },
        ],
      },
      eagerness: 'moderate',
    },
  ],
};
