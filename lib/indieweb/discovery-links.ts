// next.config.ts loads this file through lib/response-headers.ts, and
// Next's config loader resolves `@/` against the wrong folder for a file
// under lib/, so every import on that path stays relative.
import {
  INDIEAUTH_AUTHORIZATION_ENDPOINT,
  INDIEAUTH_METADATA_ENDPOINT,
  INDIEAUTH_TOKEN_ENDPOINT,
  MICROPUB_ENDPOINT,
  WEBMENTION_ENDPOINT,
  WEBSUB_HUB,
} from './constants';

/**
 * How a client finds the IndieAuth server. `indieauth-metadata` is the
 * current mechanism; the two endpoint links serve clients written before it.
 * The head in `app/layout.tsx` and the WebFinger response both render this
 * list, so they cannot drift apart.
 */
export const INDIEAUTH_DISCOVERY_LINKS = [
  { rel: 'indieauth-metadata', href: INDIEAUTH_METADATA_ENDPOINT },
  { rel: 'authorization_endpoint', href: INDIEAUTH_AUTHORIZATION_ENDPOINT },
  { rel: 'token_endpoint', href: INDIEAUTH_TOKEN_ENDPOINT },
] as const;

/**
 * Every endpoint a client discovers from a page: where to send mentions
 * and posts, how to sign in as this site, and the WebSub hub. The head in
 * `app/layout.tsx` renders them as `<link>` elements, and every page
 * response repeats them in an HTTP `Link` header (lib/response-headers.ts)
 * for clients that read headers without parsing HTML. Both render this
 * list, so they cannot drift apart. The paths stay relative, as they are in
 * the head, so a preview deployment advertises its own endpoints.
 */
export const ENDPOINT_DISCOVERY_LINKS = [
  { rel: 'webmention', href: WEBMENTION_ENDPOINT },
  { rel: 'micropub', href: MICROPUB_ENDPOINT },
  ...INDIEAUTH_DISCOVERY_LINKS,
  { rel: 'hub', href: WEBSUB_HUB },
] as const;

/** Links as one RFC 8288 `Link` header value. */
export function linkHeader(
  links: ReadonlyArray<{ rel: string; href: string }>
): string {
  return links.map(({ rel, href }) => `<${href}>; rel="${rel}"`).join(', ');
}
