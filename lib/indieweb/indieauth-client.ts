import { mf2 } from 'microformats-parser';

import {
  type AddressResolver,
  type DocumentFetch,
  fetchPublicDocument,
} from '@/lib/indieweb/public-fetch';
import type { IndieAuthClientInfo } from '@/lib/indieweb/types';

/**
 * IndieAuth clients have no registration step: a client is identified by a
 * URL, and that URL's document says who the client is and where it may be
 * redirected. These helpers check the URLs and read that document
 * (indieauth.spec.indieweb.org, "Client Identifier" and "Client Metadata").
 */

const CLIENT_FETCH_TIMEOUT_MS = 5000;
/** Bytes read from a client document before giving up on it. */
export const CLIENT_DOCUMENT_MAX_BYTES = 1024 * 1024;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

export function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname);
}

/**
 * A `client_id` as the spec allows it: an http(s) URL with a path, no
 * fragment, no credentials, no `.` or `..` path segments, and a domain name
 * rather than an IP address unless it is the loopback address.
 */
export function parseClientId(value: string | null): URL | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.hash || value.includes('#')) return null;
  if (url.username || url.password) return null;
  // URL parsing resolves dot segments away, so look at what was sent.
  const rawPath = value.replace(/^[a-z]+:\/\/[^/?#]*/i, '').split(/[?#]/)[0];
  if (rawPath.split('/').some((segment) => segment === '.' || segment === '..'))
    return null;
  const { hostname } = url;
  const isIp = IPV4_PATTERN.test(hostname) || hostname.startsWith('[');
  if (isIp && !isLoopbackHost(hostname)) return null;
  return url;
}

/** A `redirect_uri`: any absolute URL without a fragment. */
export function parseRedirectUri(value: string | null): URL | null {
  if (!value || value.includes('#')) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * A redirect URI on the client's own scheme, host, and port is always
 * allowed. Any other one must be listed by the client's metadata, which is
 * what stops a stranger from sending a code to their own server under a real
 * client's name.
 */
export function isRedirectUriAllowed(
  clientId: URL,
  redirectUri: URL,
  client: IndieAuthClientInfo
): boolean {
  if (
    clientId.protocol === redirectUri.protocol &&
    clientId.host === redirectUri.host
  ) {
    return true;
  }
  // Listed URIs are compared as parsed URLs, so `https://App.example` and
  // `https://app.example/` are the same redirect.
  return client.redirectUris.some(
    (listed) => parseRedirectUri(listed)?.href === redirectUri.href
  );
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return value || undefined;
  if (Array.isArray(value)) return firstString(value[0]);
  if (value && typeof value === 'object' && 'value' in value) {
    return firstString((value as { value: unknown }).value);
  }
  return undefined;
}

/**
 * Read a JSON client metadata document. It only counts when its
 * `client_id` is the URL it was fetched from.
 */
export function parseClientMetadataJson(
  clientId: string,
  body: unknown
): IndieAuthClientInfo {
  if (!body || typeof body !== 'object') return { redirectUris: [] };
  const metadata = body as Record<string, unknown>;
  // Compared as parsed URLs, so a host-only `client_id` matches the same URL
  // with the `/` path the URL parser gives it.
  const listed =
    typeof metadata.client_id === 'string'
      ? parseClientId(metadata.client_id)
      : null;
  const fetched = parseClientId(clientId);
  if (!listed || !fetched || listed.href !== fetched.href) {
    return { redirectUris: [] };
  }
  const redirectUris = Array.isArray(metadata.redirect_uris)
    ? metadata.redirect_uris.filter(
        (uri): uri is string => typeof uri === 'string'
      )
    : [];
  return {
    name: firstString(metadata.client_name),
    url: firstString(metadata.client_uri),
    logo: firstString(metadata.logo_uri),
    redirectUris,
  };
}

/**
 * Read an HTML client page: `rel="redirect_uri"` links, and an `h-app` for
 * the name, URL, and logo.
 */
export function parseClientHtml(
  html: string,
  baseUrl: string
): IndieAuthClientInfo {
  const parsed = mf2(html, { baseUrl });
  const app = parsed.items.find((item) =>
    item.type?.some((type) => type === 'h-app' || type === 'h-x-app')
  );
  return {
    name: firstString(app?.properties.name),
    url: firstString(app?.properties.url),
    logo: firstString(app?.properties.logo),
    redirectUris: parsed.rels.redirect_uri ?? [],
  };
}

export interface ClientFetchOptions {
  /** Resolves host names; the system resolver by default. */
  resolve?: AddressResolver;
  /** Makes each request; a public-only fetch over `resolve` by default. */
  fetch?: DocumentFetch;
}

/**
 * Fetch what the client says about itself. A client that cannot be fetched
 * still signs in, but only with a redirect URI on its own host. Loopback
 * clients are never fetched. Anyone can start a sign-in with any
 * `client_id`, before the owner has approved anything, so the document comes
 * through `fetchPublicDocument`, which never reaches a host that is not on
 * the public internet.
 */
export async function fetchIndieAuthClient(
  clientId: string,
  { resolve, fetch }: ClientFetchOptions = {}
): Promise<IndieAuthClientInfo> {
  const none: IndieAuthClientInfo = { redirectUris: [] };
  const url = parseClientId(clientId);
  if (!url || isLoopbackHost(url.hostname)) return none;

  try {
    const document = await fetchPublicDocument(url.href, {
      resolve,
      fetch,
      headers: { Accept: 'application/json, text/html;q=0.9' },
      maxBytes: CLIENT_DOCUMENT_MAX_BYTES,
      timeoutMs: CLIENT_FETCH_TIMEOUT_MS,
    });
    if (!document || document.status < 200 || document.status > 299) {
      return none;
    }
    if (document.contentType.includes('json')) {
      return parseClientMetadataJson(clientId, JSON.parse(document.body));
    }
    return parseClientHtml(document.body, document.url);
  } catch (error) {
    console.error('Fetching IndieAuth client metadata failed:', error);
    return none;
  }
}
