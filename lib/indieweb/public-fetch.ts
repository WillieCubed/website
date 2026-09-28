import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, type LookupFunction, isIP } from 'node:net';
import { Agent, buildConnector, fetch as undiciFetch } from 'undici';

/*
 * Several requests this server makes are on a stranger's say-so: an IndieAuth
 * client's metadata, a webmention's source, the author page a source names,
 * and a vouch. Each one must never reach the server's own network: cloud
 * metadata at 169.254.169.254, private ranges, or loopback. A name is checked
 * when it is resolved for the connection itself, not only beforehand, so a
 * name that answers with a public address first and a private one second
 * (DNS rebinding) still cannot connect anywhere private.
 */

/** How long a connection may take to open before it is given up. */
const CONNECT_TIMEOUT_MS = 5000;
/** Bytes read from a document before giving up on it, unless a caller says. */
export const PUBLIC_DOCUMENT_MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;

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
const loopback = new BlockList();
loopback.addSubnet('127.0.0.0', 8, 'ipv4');
loopback.addAddress('::1', 'ipv6');

/**
 * The local write test (docs/indieweb/testing.md) serves its webmention
 * source from 127.0.0.1, which this guard exists to refuse. It sets
 * `INDIEWEB_TEST_ALLOW_LOOPBACK=true` to let loopback through, and only
 * loopback: private ranges and cloud metadata stay refused. A Vercel
 * deployment ignores the variable, so it cannot open the hole there.
 */
function loopbackAllowed(): boolean {
  return (
    process.env.INDIEWEB_TEST_ALLOW_LOOPBACK === 'true' && !process.env.VERCEL
  );
}

/**
 * Whether an IP address is on the public internet. Anything unparseable,
 * private, loopback, link-local, shared, multicast, reserved, or an IPv6
 * form of an IPv4 address is not.
 */
export function isPublicAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  try {
    const family = isIP(bare);
    if (
      family !== 0 &&
      loopbackAllowed() &&
      loopback.check(bare, family === 4 ? 'ipv4' : 'ipv6')
    ) {
      return true;
    }
    switch (family) {
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

export const systemResolver: AddressResolver = (hostname) =>
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
    timeout: CONNECT_TIMEOUT_MS,
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

/** How documents are requested. Tests pass their own. */
export type DocumentFetch = (
  url: string,
  init: {
    headers: Record<string, string>;
    redirect: 'manual';
    signal: AbortSignal;
  }
) => Promise<Response>;

let sharedAgent: Agent | undefined;

function publicOnlyFetch(resolve: AddressResolver): DocumentFetch {
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

export interface PublicFetchOptions {
  /** Resolves host names; the system resolver by default. */
  resolve?: AddressResolver;
  /** Makes each request; a public-only fetch over `resolve` by default. */
  fetch?: DocumentFetch;
  /** Request headers, such as Accept and User-Agent. */
  headers?: Record<string, string>;
  /** Bytes of body to read at most. */
  maxBytes?: number;
  /** Milliseconds for the whole exchange, redirects included. */
  timeoutMs: number;
}

/** A document reached on the public internet, after any redirects. */
export interface PublicDocument {
  /** The address the document came from, after redirects. */
  url: string;
  status: number;
  contentType: string;
  /** The body, or '' for a status outside 200–299, which is not read. */
  body: string;
}

/**
 * Fetch a document from a public address. Redirects are followed by hand, at
 * most three, and each one is checked like the first URL. Resolves null when
 * an address is not public http(s), when the redirects run out, or when the
 * body is larger than `maxBytes`. A network error or the timeout throws, so
 * the caller can tell an unreachable host from a refused one.
 */
export async function fetchPublicDocument(
  address: string,
  {
    resolve = systemResolver,
    fetch,
    headers = {},
    maxBytes = PUBLIC_DOCUMENT_MAX_BYTES,
    timeoutMs,
  }: PublicFetchOptions
): Promise<PublicDocument | null> {
  const request = fetch ?? publicOnlyFetch(resolve);
  const signal = AbortSignal.timeout(timeoutMs);
  let current = new URL(address);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isFetchableUrl(current, resolve))) return null;
    const response = await request(current.href, {
      headers,
      redirect: 'manual',
      signal,
    });

    if (REDIRECT_STATUSES.has(response.status)) {
      await response.body?.cancel().catch(() => {});
      const location = response.headers.get('location');
      if (!location) return null;
      current = new URL(location, current);
      continue;
    }
    const document = {
      url: current.href,
      status: response.status,
      contentType: response.headers.get('content-type') ?? '',
    };
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return { ...document, body: '' };
    }
    const length = Number(response.headers.get('content-length'));
    if (length > maxBytes) {
      await response.body?.cancel().catch(() => {});
      return null;
    }
    const body = await readCappedText(response.body, maxBytes);
    return body === null ? null : { ...document, body };
  }
  return null;
}
