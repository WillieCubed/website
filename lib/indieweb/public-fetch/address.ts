import { getCloudflareContext } from '@opennextjs/cloudflare';
import { lookup as dnsLookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

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
 * The local write test serves its webmention
 * source from 127.0.0.1, which this guard exists to refuse. It sets
 * `INDIEWEB_TEST_ALLOW_LOOPBACK=true` to let loopback through, and only
 * loopback: private ranges and cloud metadata stay refused. Production
 * ignores the variable, so it cannot open the hole there.
 */
function loopbackAllowed(): boolean {
  return (
    process.env.INDIEWEB_TEST_ALLOW_LOOPBACK === 'true' &&
    process.env.NODE_ENV !== 'production'
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

interface ResolvedAddress {
  address: string;
  family: number;
}

/** Every address a host name resolves to. Tests pass their own. */
export type AddressResolver = (hostname: string) => Promise<ResolvedAddress[]>;

export const systemResolver: AddressResolver = (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

export function blockedAddressError(hostname: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(
    `Refusing to connect to ${hostname}: it does not resolve to a public address`
  );
  error.code = 'ENOTFOUND';
  return error;
}

/** Resolve a name, and fail unless every address it has is public. */
export async function resolvePublicAddresses(
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

export function isCloudflareRuntime(): boolean {
  try {
    return Boolean(getCloudflareContext().env.HYPERDRIVE);
  } catch {
    return false;
  }
}

/**
 * Whether a URL may be fetched at all: http(s), no credentials, and a public
 * destination. Node checks DNS here and again during connection. Workers do
 * not implement dns.lookup; their fetch proxy restricts outbound requests to
 * the public internet, and we still reject nonpublic IP literals and local
 * hostnames before making a request.
 */
export async function isFetchableUrl(
  url: URL,
  resolve: AddressResolver,
  cloudflareRuntime = isCloudflareRuntime()
): Promise<boolean> {
  if (!['https:', 'http:'].includes(url.protocol)) return false;
  if (url.username || url.password) return false;
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(hostname) !== 0) return isPublicAddress(hostname);
  if (resolve === systemResolver && cloudflareRuntime) {
    const name = hostname.replace(/\.+$/, '');
    return name !== 'localhost' && !name.endsWith('.localhost');
  }
  try {
    await resolvePublicAddresses(hostname, resolve);
    return true;
  } catch {
    return false;
  }
}
