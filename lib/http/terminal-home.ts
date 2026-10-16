import { homepageNegotiationHeaders } from './response-headers';
import { renderTerminalHome } from './terminal-home-content';
import { selectTerminalFormat } from './terminal-home-negotiation';

/**
 * Apply the same cache policy to terminal output and HTML fallthrough.
 * Next replaces HTML's Vary header, so neither representation may be reused
 * by HTTP caches without running request selection again.
 */
export const terminalHomeHeaders = {
  ...homepageNegotiationHeaders,
  'Cache-Control': 'private, no-store',
};

function isEligibleRequest(request: Request): boolean {
  const { pathname, search } = new URL(request.url);
  return (
    pathname === '/' &&
    search === '' &&
    ['GET', 'HEAD'].includes(request.method) &&
    request.headers.get('X-Original')?.toLowerCase() !== 'true' &&
    !request.headers.has('RSC') &&
    !request.headers.has('Next-Router-Prefetch')
  );
}

/**
 * Answer eligible homepage requests with ANSI-styled or plain terminal text.
 * Return undefined when Next should continue normal routing, including HTML
 * overrides, query strings, and router requests. HEAD selects the same headers
 * as GET without rendering a body.
 *
 * The caller must enforce private-preview authentication before calling this
 * function. This handler selects a public representation; it grants no access.
 */
export function terminalHome(request: Request): Response | undefined {
  if (!isEligibleRequest(request)) return undefined;
  const format = selectTerminalFormat(request.headers);
  if (format === undefined) return undefined;

  return new Response(
    request.method === 'HEAD' ? null : renderTerminalHome(format),
    {
      headers: {
        ...terminalHomeHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    }
  );
}
