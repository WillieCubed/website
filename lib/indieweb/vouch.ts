import { type DefaultTreeAdapterMap, parse } from 'parse5';

import {
  type AddressResolver,
  type DocumentFetch,
  fetchPublicDocument,
} from '@/lib/indieweb/public-fetch';
import { sitePath } from '@/lib/indieweb/webmention-targets';

/**
 * Vouch (https://indieweb.org/Vouch) lets a sender this site has never heard
 * from skip moderation by naming a page on a domain this site already
 * trusts, where that page links to the sender's domain. It is the only way a
 * webmention approves itself; everything else waits for Willie.
 */

const VOUCH_TIMEOUT_MS = 5000;

/** The storage calls a vouch check needs. */
export interface VouchStore {
  /** Whether a webmention from this host was ever approved. */
  hasApprovedSource: (host: string) => Promise<boolean>;
  /** Addresses that accepted a webmention this site sent. */
  acceptedTargets: () => Promise<string[]>;
  /**
   * Approve a verified webmention and record the vouch that approved it.
   * Resolves false when the row is not verified, rejected, or approved.
   */
  approveByVouch: (id: string, vouchUrl: string) => Promise<boolean>;
}

export interface VouchOptions {
  /** Resolves host names for the vouch fetch; the system resolver by default. */
  resolve?: AddressResolver;
  /** Requests the vouch page; a public-only fetch by default. */
  fetch?: DocumentFetch;
}

export type VouchOutcome =
  /** The vouch held, and the webmention is approved. */
  | 'approved'
  /** The sender's domain already has an approved webmention; moderation as usual. */
  | 'known-sender'
  /** The vouch page is not on a domain this site trusts. */
  | 'untrusted'
  /** The vouch page could not be read. */
  | 'unreadable'
  /** The vouch page does not link to the sender's domain. */
  | 'no-link'
  /** The row was no longer waiting for approval. */
  | 'not-pending';

/**
 * A domain as Vouch compares domains: lowercase, without the port or a
 * leading `www.`, so `www.example.com` vouches the same as `example.com`.
 */
export function vouchDomain(address: string): string | null {
  try {
    return new URL(address).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * A `vouch` parameter as the receiver accepts it: absent, or an absolute
 * http(s) URL. Anything else is a bad request, as a bad source is.
 */
export function readVouchParameter(
  value: unknown
): { vouch: string | null } | { error: string } {
  if (value === null || value === undefined || value === '') {
    return { vouch: null };
  }
  if (typeof value !== 'string') return { error: 'Invalid vouch URL.' };
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return { vouch: url.href };
    }
  } catch {
    // Falls through to the error below.
  }
  return { error: 'Invalid vouch URL.' };
}

/**
 * Whether a vouch page links to a domain: some `<a>` or `<area>` with an
 * href that resolves, against the page, to a URL on it. Markup inside
 * comments or scripts never counts, since the page is parsed as HTML.
 */
export function linksToDomain(
  html: string,
  pageUrl: string,
  domain: string
): boolean {
  type ParentNode = DefaultTreeAdapterMap['parentNode'];
  const walk = (node: ParentNode): boolean =>
    node.childNodes.some((child) => {
      if (!('tagName' in child)) return false;
      if (child.tagName === 'a' || child.tagName === 'area') {
        const href = child.attrs.find((attr) => attr.name === 'href')?.value;
        if (href !== undefined && URL.canParse(href, pageUrl)) {
          const url = new URL(href, pageUrl);
          if (
            (url.protocol === 'https:' || url.protocol === 'http:') &&
            vouchDomain(url.href) === domain
          ) {
            return true;
          }
        }
      }
      return walk(child);
    });
  return walk(parse(html));
}

/**
 * A domain this site trusts to vouch: its own, or one that accepted a
 * webmention this site sent. The second rule is narrower than "any domain a
 * post links to" on purpose. A silo such as GitHub runs no webmention
 * receiver, so a post linking to a repository does not let every GitHub
 * page vouch for a stranger.
 */
async function isTrustedDomain(
  address: string,
  store: VouchStore
): Promise<boolean> {
  if (sitePath(address) !== null) return true;
  const domain = vouchDomain(address);
  if (!domain) return false;
  const accepted = await store.acceptedTargets();
  return accepted.some((target) => vouchDomain(target) === domain);
}

/**
 * Check a vouch for a verified webmention and approve it when the vouch
 * holds. A sender whose domain already has an approved webmention needs no
 * vouch, so its vouch is ignored and the mention waits for moderation as
 * every other does.
 */
export async function applyVouch(
  {
    id,
    sourceUrl,
    vouchUrl,
  }: { id: string; sourceUrl: string; vouchUrl: string },
  store: VouchStore,
  { resolve, fetch }: VouchOptions = {}
): Promise<VouchOutcome> {
  const sourceDomain = vouchDomain(sourceUrl);
  if (!sourceDomain) return 'no-link';
  if (await store.hasApprovedSource(sourceDomain)) return 'known-sender';
  if (!(await isTrustedDomain(vouchUrl, store))) return 'untrusted';

  const page = await fetchPublicDocument(vouchUrl, {
    resolve,
    fetch,
    headers: {
      Accept: 'text/html',
      'User-Agent': 'WillieCubed-Webmention-Verifier/1.0',
    },
    timeoutMs: VOUCH_TIMEOUT_MS,
  }).catch(() => null);
  if (!page || page.status < 200 || page.status > 299) return 'unreadable';
  // A redirect may have left the trusted domain; the page that answered counts.
  if (!(await isTrustedDomain(page.url, store))) return 'untrusted';
  if (!linksToDomain(page.body, page.url, sourceDomain)) return 'no-link';

  return (await store.approveByVouch(id, vouchUrl))
    ? 'approved'
    : 'not-pending';
}
