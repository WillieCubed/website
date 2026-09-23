import { mf2 } from 'microformats-parser';
import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, type LookupFunction, isIP } from 'node:net';
import { Agent, buildConnector, fetch as undiciFetch } from 'undici';

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
const CLIENT_MAX_REDIRECTS = 3;
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

/*
 * Anyone can start a sign-in with any `client_id`, before the owner has
 * approved anything, so the metadata fetch is a request this server makes on
 * a stranger's behalf. It must never reach the server's own network: cloud
 * metadata at 169.254.169.254, private ranges, or loopback. A name is checked
 * when it is resolved for the connection itself, not only beforehand, so a
 * name that answers with a public address first and a private one second
 * (DNS rebinding) still cannot connect anywhere private.
 */

/** Special-purpose IPv4 ranges (IANA registry) that are never fetched. */
const BLOCKED_IPV4: [string, number][] = [
  ['0.0.0.0', 8], // "this" network and unspecified
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, including cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved and broadcast
];

/**
 * Special-purpose ranges inside global unicast `2000::/3`. Everything outside
 * `2000::/3` is refused outright: unspecified, loopback, IPv4-mapped, NAT64,
 * discard, unique local `fc00::/7`, link-local `fe80::/10`, and multicast.
 */
const BLOCKED_IPV6: [string, number][] = [
  ['2001::', 23], // IETF protocol assignments, including Teredo
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4, which embeds an IPv4 address
  ['3fff::', 20], // documentation
];

const blockedAddresses = new BlockList();
for (const [network, prefix] of BLOCKED_IPV4) {
  blockedAddresses.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of BLOCKED_IPV6) {
  blockedAddresses.addSubnet(network, prefix, 'ipv6');
}
const globalUnicast = new BlockList();
globalUnicast.addSubnet('2000::', 3, 'ipv6');

/**
 * Whether an IP address is on the public internet. Anything unparseable,
 * private, loopback, link-local, shared, multicast, reserved, or an IPv6
 * form of an IPv4 address is not.
 */
export function isPublicAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  try {
    switch (isIP(bare)) {
      case 4:
        return !blockedAddresses.check(bare, 'ipv4');
      case 6:
        return (
          globalUnicast.check(bare, 'ipv6') &&
          !blockedAddresses.check(bare, 'ipv6')
        );
      default:
        return false;
    }
  } catch {
    return false;
  }
}

export interface ResolvedAddress {
  address: string;
  family: number;
}

/** Every address a host name resolves to. Tests pass their own. */
export type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;

const systemResolver: AddressResolver = (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

function blockedAddressError(hostname: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(
    `Refusing to connect to ${hostname}: it does not resolve to a public address`
  );
  error.code = 'ENOTFOUND';
  return error;
}

/** Resolve a name, and fail unless every address it has is public. */
async function resolvePublicAddresses(
  hostname: string,
  resolve: AddressResolver
): Promise<ResolvedAddress[]> {
  const addresses = await resolve(hostname);
  if (
    addresses.length === 0 ||
    !addresses.every(({ address }) => isPublicAddress(address))
  ) {
    throw blockedAddressError(hostname);
  }
  return addresses;
}

function wantedFamily(family: number | string | undefined): 0 | 4 | 6 {
  if (family === 4 || family === 'IPv4') return 4;
  if (family === 6 || family === 'IPv6') return 6;
  return 0;
}

/**
 * A `lookup` for sockets that resolves with `resolve` and refuses a name if
 * any of its addresses is not public. This runs for the connection itself, so
 * the address checked is the address connected to.
 */
export function createPublicOnlyLookup(
  resolve: AddressResolver = systemResolver
): LookupFunction {
  return (hostname, options, callback) => {
    resolvePublicAddresses(hostname, resolve).then(
      (resolved) => {
        const wanted = wantedFamily(options.family);
        const addresses = wanted
          ? resolved.filter(({ family }) => family === wanted)
          : resolved;
        if (addresses.length === 0) {
          callback(blockedAddressError(hostname), '');
        } else if (options.all) {
          callback(null, addresses);
        } else {
          callback(null, addresses[0].address, addresses[0].family);
        }
      },
      (error: NodeJS.ErrnoException) => callback(error, '')
    );
  };
}

/**
 * A dispatcher whose sockets only connect to public addresses: names go
 * through the public-only lookup, and the connected peer is checked again,
 * which also covers IP literals that never reach a lookup.
 */
export function createPublicOnlyAgent(
  resolve: AddressResolver = systemResolver
): Agent {
  const connector = buildConnector({
    lookup: createPublicOnlyLookup(resolve),
    timeout: CLIENT_FETCH_TIMEOUT_MS,
  });
  return new Agent({
    connect(options, callback) {
      connector(options, (error, socket) => {
        if (error) {
          callback(error, null);
          return;
        }
        const peer = socket?.remoteAddress;
        if (!socket || !peer || !isPublicAddress(peer)) {
          socket?.destroy();
          callback(blockedAddressError(options.hostname), null);
          return;
        }
        callback(null, socket);
      });
    },
  });
}

/** How client documents are requested. Tests pass their own. */
export type ClientDocumentFetch = (
  url: string,
  init: {
    headers: Record<string, string>;
    redirect: 'manual';
    signal: AbortSignal;
  }
) => Promise<Response>;

let sharedAgent: Agent | undefined;

function publicOnlyFetch(resolve: AddressResolver): ClientDocumentFetch {
  const dispatcher =
    resolve === systemResolver
      ? (sharedAgent ??= createPublicOnlyAgent())
      : createPublicOnlyAgent(resolve);
  return async (url, init) =>
    (await undiciFetch(url, { ...init, dispatcher })) as unknown as Response;
}

/**
 * Whether a URL may be fetched at all: http(s), no credentials, and a host
 * whose every address is public right now. The connection checks again.
 */
async function isFetchableUrl(
  url: URL,
  resolve: AddressResolver
): Promise<boolean> {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.username || url.password) return false;
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname)) return isPublicAddress(hostname);
  try {
    await resolvePublicAddresses(hostname, resolve);
    return true;
  } catch {
    return false;
  }
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Read a body as text, stopping once it passes `limit` bytes. Resolves null
 * for a body that is too large, without reading the rest of it.
 */
export async function readCappedText(
  body: ReadableStream<Uint8Array> | null,
  limit: number
): Promise<string | null> {
  if (!body) return '';
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export interface ClientFetchOptions {
  /** Resolves host names; the system resolver by default. */
  resolve?: AddressResolver;
  /** Makes each request; a public-only fetch over `resolve` by default. */
  fetch?: ClientDocumentFetch;
}

/**
 * Fetch what the client says about itself. A client that cannot be fetched
 * still signs in, but only with a redirect URI on its own host. Loopback
 * clients are never fetched, and neither is any host that is not on the
 * public internet. Redirects are followed by hand, at most three, and each
 * one is checked like the first URL.
 */
export async function fetchIndieAuthClient(
  clientId: string,
  { resolve = systemResolver, fetch }: ClientFetchOptions = {}
): Promise<IndieAuthClientInfo> {
  const none: IndieAuthClientInfo = { redirectUris: [] };
  const url = parseClientId(clientId);
  if (!url || isLoopbackHost(url.hostname)) return none;

  const request = fetch ?? publicOnlyFetch(resolve);
  const signal = AbortSignal.timeout(CLIENT_FETCH_TIMEOUT_MS);
  try {
    let current = url;
    for (let hop = 0; hop <= CLIENT_MAX_REDIRECTS; hop++) {
      if (!(await isFetchableUrl(current, resolve))) return none;
      const response = await request(current.href, {
        headers: { Accept: 'application/json, text/html;q=0.9' },
        redirect: 'manual',
        signal,
      });

      if (REDIRECT_STATUSES.has(response.status)) {
        await response.body?.cancel().catch(() => {});
        const location = response.headers.get('location');
        if (!location) return none;
        current = new URL(location, current);
        continue;
      }
      const length = Number(response.headers.get('content-length'));
      if (!response.ok || length > CLIENT_DOCUMENT_MAX_BYTES) {
        await response.body?.cancel().catch(() => {});
        return none;
      }
      const body = await readCappedText(
        response.body,
        CLIENT_DOCUMENT_MAX_BYTES
      );
      if (body === null) return none;

      const type = response.headers.get('content-type') ?? '';
      if (type.includes('json')) {
        return parseClientMetadataJson(clientId, JSON.parse(body));
      }
      return parseClientHtml(body, current.href);
    }
    return none;
  } catch (error) {
    console.error('Fetching IndieAuth client metadata failed:', error);
    return none;
  }
}
