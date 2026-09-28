import { mf2 } from 'microformats-parser';

import { fetchPublicDocument } from '@/lib/indieweb/public-fetch';
import type { ExtractedWebmentionAuthor } from '@/lib/indieweb/types';

type ParsedDocument = ReturnType<typeof mf2>;
type MicroformatRoot = ParsedDocument['items'][number];
type MicroformatProperty = MicroformatRoot['properties'][string][number];

const AUTHOR_PAGE_TIMEOUT_MS = 5000;

/** An author page fetched and parsed, or null when it could not be read. */
export type AuthorPageFetcher = (
  url: string
) => Promise<{ url: string; html: string } | null>;

/**
 * The author page comes from a stranger's markup, so it is fetched only from
 * public addresses, with the same limits as the webmention source.
 */
export const fetchAuthorPage: AuthorPageFetcher = async (url) => {
  const document = await fetchPublicDocument(url, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'WillieCubed-Webmention-Verifier/1.0',
    },
    timeoutMs: AUTHOR_PAGE_TIMEOUT_MS,
  });
  if (!document || document.status < 200 || document.status > 299) {
    return null;
  }
  return { url: document.url, html: document.body };
};

/** The first h-entry in a document, and the h-feed it sits in, if any. */
export function findEntry(
  items: MicroformatRoot[],
  feed?: MicroformatRoot
): { entry: MicroformatRoot; feed?: MicroformatRoot } | null {
  for (const item of items) {
    if (item.type?.includes('h-entry')) return { entry: item, feed };
    if (item.children) {
      const inside = item.type?.includes('h-feed') ? item : feed;
      const found = findEntry(item.children, inside);
      if (found) return found;
    }
  }
  return null;
}

function isCard(value: unknown): value is MicroformatRoot {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    Array.isArray(value.type) &&
    value.type.includes('h-card')
  );
}

/**
 * A property's text. A `u-*` value on an image with alt text parses as
 * `{value, alt}`, and an embedded item carries its own `value`.
 */
function text(value: MicroformatProperty | undefined): string | undefined {
  if (typeof value === 'string') return value || undefined;
  if (value && 'value' in value && typeof value.value === 'string') {
    return value.value || undefined;
  }
  return undefined;
}

function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Two addresses name the same page once parsed, so a trailing slash on a
 * bare origin does not matter.
 */
function sameUrl(left: string | undefined, right: string): boolean {
  if (!left) return false;
  try {
    return new URL(left).href === new URL(right).href;
  } catch {
    return false;
  }
}

/**
 * An h-card as an author. A `u-photo` with non-empty alt text parses as
 * `{value, alt}` rather than a string, and its `value` is the photo URL. The
 * alt is not kept: the avatar is labelled with the author's name, and the
 * whole entry is stored as `rawMf2` anyway.
 */
export function cardAuthor(card: MicroformatRoot): ExtractedWebmentionAuthor {
  const { name, url, photo } = card.properties;
  const author: ExtractedWebmentionAuthor = {
    name: text(name?.[0]),
    url: text(url?.[0]),
    photo: text(photo?.[0]),
  };
  return Object.fromEntries(
    Object.entries(author).filter(([, value]) => value !== undefined)
  );
}

/**
 * The author an h-entry names itself, without fetching anything: its
 * embedded h-card, the address it gives, or the name it gives.
 */
export function extractAuthor(
  hEntry: MicroformatRoot
): ExtractedWebmentionAuthor {
  const author = hEntry.properties.author?.[0];
  if (isCard(author)) return cardAuthor(author);
  const value = text(author);
  if (!value) return {};
  return isWebUrl(value) ? { url: value } : { name: value };
}

/** Every h-card in a document, top level first, then nested ones. */
function cards(items: MicroformatRoot[]): MicroformatRoot[] {
  const found: MicroformatRoot[] = [];
  const nested: MicroformatRoot[] = [];
  for (const item of items) {
    if (item.type?.includes('h-card')) found.push(item);
    if (item.children) nested.push(...cards(item.children));
  }
  return [...found, ...nested];
}

/**
 * The page is the entry's permalink when the entry says so, or when the
 * entry is the only thing the page publishes. A feed page's rel-author names
 * whoever runs the feed, not necessarily who wrote this entry.
 */
function isPermalinkPage(
  document: ParsedDocument,
  entry: MicroformatRoot,
  pageUrl: string
): boolean {
  if (entry.properties.url?.some((url) => sameUrl(text(url), pageUrl))) {
    return true;
  }
  const entries = document.items.filter((item) =>
    item.type?.some((type) => type === 'h-entry' || type === 'h-feed')
  );
  return entries.length === 1 && entries[0] === entry;
}

/**
 * The h-card that speaks for an author page: one whose `url` and `uid` are
 * both the page's address, or else one whose `url` is among the page's
 * `rel=me` links.
 */
function representativeCard(
  document: ParsedDocument,
  pageUrls: string[]
): MicroformatRoot | undefined {
  const all = cards(document.items);
  const isPage = (value: MicroformatProperty) =>
    pageUrls.some((pageUrl) => sameUrl(text(value), pageUrl));
  const byUid = all.find(
    (card) =>
      card.properties.url?.some(isPage) && card.properties.uid?.some(isPage)
  );
  if (byUid) return byUid;
  const me = document.rels.me ?? [];
  return all.find((card) =>
    card.properties.url?.some((url) =>
      me.some((link) => sameUrl(text(url), link))
    )
  );
}

export interface AuthorshipOptions {
  /** Reads an author page; a public-only fetch by default. */
  fetchAuthorPage?: AuthorPageFetcher;
}

/**
 * Who wrote an h-entry, by the authorship algorithm
 * (https://indieweb.org/authorship-spec):
 *
 * 1. The entry's `author`, or else its parent h-feed's.
 * 2. An h-card there is the author. Plain text is the author's name. An
 *    address is the author page.
 * 3. With no author page yet, a permalink page's `rel=author` link is one.
 * 4. The author page's representative h-card is the author, or else an
 *    h-card on the entry's own page whose `url` is the author page.
 *
 * When the entry names an author page that yields no card, its address is
 * still returned, so the reply links to its author even without a name.
 * Nothing fetched here is cached.
 */
export async function discoverAuthor(
  document: ParsedDocument,
  { entry, feed }: { entry: MicroformatRoot; feed?: MicroformatRoot },
  pageUrl: string,
  { fetchAuthorPage: fetchPage = fetchAuthorPage }: AuthorshipOptions = {}
): Promise<ExtractedWebmentionAuthor> {
  const property = entry.properties.author?.length
    ? entry.properties.author[0]
    : feed?.properties.author?.[0];

  let authorPage: string | undefined;
  let named = false;
  if (property !== undefined) {
    if (isCard(property)) return cardAuthor(property);
    const value = text(property);
    if (value && !isWebUrl(value)) return { name: value };
    authorPage = value;
    named = Boolean(value);
  }

  if (!authorPage && isPermalinkPage(document, entry, pageUrl)) {
    authorPage = document.rels.author?.[0];
  }
  if (!authorPage) return {};

  try {
    const page = await fetchPage(authorPage);
    if (page) {
      // The page may have redirected, and either address is the page's.
      const card = representativeCard(mf2(page.html, { baseUrl: page.url }), [
        authorPage,
        page.url,
      ]);
      if (card) return cardAuthor(card);
    }
  } catch (error) {
    console.error('Fetching a webmention author page failed:', error);
  }

  const onEntryPage = cards(document.items).find((card) =>
    card.properties.url?.some((url) => sameUrl(text(url), authorPage))
  );
  if (onEntryPage) return cardAuthor(onEntryPage);
  return named ? { url: authorPage } : {};
}
