import { WEBSUB_HUB } from '@/lib/indieweb/constants';
import type { ActivityFeedItem, WebmentionAuthor } from '@/lib/indieweb/types';
import type { Initiative } from '@/lib/initiatives';
import { site } from '@/lib/site';
import { siteRoute } from '@/lib/url-utils';
import type { WritingData } from '@/lib/writings';
import { writingAttachments } from '@/lib/writings/media';
import { normalizeTag, tagFeedPaths, tagPath } from '@/lib/writings/tags';

const SITE_TITLE = site.name;
const SITE_DESCRIPTION = site.description;
const AUTHOR_NAME = site.author.name;
const AUTHOR_EMAIL = site.author.email;

const WRITINGS_TITLE = "Willie's Writings";
const WRITINGS_DESCRIPTION =
  'Thoughts, tutorials, and notes on software, music, and creativity from Willie Chalmers III.';

export interface FeedItem {
  id?: string;
  title: string;
  description: string;
  /** The item's full body as HTML, from `renderFeedHtml` in ./html. */
  content?: string;
  url: string;
  published: Date;
  updated?: Date;
  categories?: string[];
  indieweb?: ActivityFeedItem['indieweb'];
  author?: WebmentionAuthor;
  attachments?: {
    url: string;
    mime_type: string;
    size_in_bytes?: number;
    title?: string;
  }[];
}

export interface RssFeedOptions {
  title?: string;
  description?: string;
  feedUrl?: string;
  /** The page the feed mirrors. Defaults to the homepage. */
  alternateUrl?: string;
}

export interface AtomFeedOptions {
  title?: string;
  subtitle?: string;
  feedUrl?: string;
  /** The page the feed mirrors. Defaults to the homepage. */
  alternateUrl?: string;
}

export interface JsonFeedOptions {
  title?: string;
  description?: string;
  feedUrl?: string;
  /** The page the feed mirrors. Defaults to the homepage. */
  alternateUrl?: string;
}

export interface ActivityRssFeedOptions {
  title: string;
  description: string;
  feedUrl: string;
  siteUrl?: string;
}

export interface ActivityAtomFeedOptions {
  title: string;
  subtitle: string;
  feedUrl: string;
  alternateUrl?: string;
}

export interface ActivityJsonFeedOptions {
  title: string;
  description: string;
  feedUrl: string;
}

/**
 * Convert a writing to a feed item.
 *
 * @param content The writing's body rendered as HTML.
 */
export function writingToFeedItem(
  writing: WritingData,
  content?: string
): FeedItem {
  return {
    title: writing.title,
    description: writing.description,
    content,
    url: siteRoute`/writings/${writing.slug}`,
    published: new Date(writing.published),
    updated: writing.lastUpdated ? new Date(writing.lastUpdated) : undefined,
    categories: writing.tags,
    attachments: writingAttachments(writing).map((media) => ({
      url: media.url,
      mime_type: media.mimeType || 'application/octet-stream',
      title: media.description,
    })),
  };
}

/**
 * Convert an initiative to a feed item, or null when it carries no date to
 * publish it under. It is dated by when it starts, or else by its last edit.
 *
 * @param content The initiative's body rendered as HTML.
 */
export function initiativeToFeedItem(
  initiative: Initiative,
  content?: string
): FeedItem | null {
  const published = initiative.starts ?? initiative.updated;
  if (!published) return null;
  return {
    title: initiative.title,
    description: initiative.description,
    content,
    url: siteRoute`${initiative.href}`,
    published,
    updated: initiative.updated,
  };
}

/**
 * Escape XML special characters.
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format a date for RSS (RFC 822).
 */
function formatRssDate(date: Date): string {
  return date.toUTCString();
}

/**
 * Format a date for Atom (ISO 8601).
 */
function formatAtomDate(date: Date): string {
  return date.toISOString();
}

/**
 * The newest item date, or now for an empty feed, which has nothing older to
 * report than the moment it was built.
 */
function latestFeedDate(items: FeedItem[]): Date {
  return (
    items
      .map((item) => item.updated || item.published)
      .sort((a, b) => b.getTime() - a.getTime())[0] || new Date()
  );
}

/**
 * Generate an RSS 2.0 feed.
 */
export function generateRssFeed(
  items: FeedItem[],
  options: RssFeedOptions = {}
): string {
  const title = options.title || SITE_TITLE;
  const description = options.description || SITE_DESCRIPTION;
  const alternateUrl = options.alternateUrl || siteRoute``;
  const feedUrl = options.feedUrl || siteRoute`/feed.xml`;

  const itemsXml = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="${item.id ? 'false' : 'true'}">${escapeXml(item.id || item.url)}</guid>
      <description>${escapeXml(item.description)}</description>
      ${item.content ? `<content:encoded>${escapeXml(item.content)}</content:encoded>` : ''}
      <pubDate>${formatRssDate(item.published)}</pubDate>
      <dc:creator>${escapeXml(item.author?.name || AUTHOR_NAME)}</dc:creator>
      ${
        item.attachments
          ?.filter((attachment) => attachment.size_in_bytes !== undefined)
          .map(
            (attachment) =>
              `<enclosure url="${escapeXml(attachment.url)}" type="${escapeXml(attachment.mime_type)}" length="${attachment.size_in_bytes}"/>`
          )
          .join('') || ''
      }
      ${item.categories?.map((cat) => `<category>${escapeXml(cat)}</category>`).join('\n      ') || ''}
    </item>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(alternateUrl)}</link>
    <description>${escapeXml(description)}</description>
    <language>en-us</language>
    <lastBuildDate>${formatRssDate(latestFeedDate(items))}</lastBuildDate>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>
    <atom:link href="${escapeXml(WEBSUB_HUB)}" rel="hub"/>
    <managingEditor>${escapeXml(AUTHOR_EMAIL)} (${escapeXml(AUTHOR_NAME)})</managingEditor>
    <webMaster>${escapeXml(AUTHOR_EMAIL)} (${escapeXml(AUTHOR_NAME)})</webMaster>
${itemsXml}
  </channel>
</rss>`;
}

/**
 * Generate an Atom 1.0 feed.
 */
export function generateAtomFeed(
  items: FeedItem[],
  options: AtomFeedOptions = {}
): string {
  const title = options.title || SITE_TITLE;
  const subtitle = options.subtitle || SITE_DESCRIPTION;
  const alternateUrl = options.alternateUrl || siteRoute``;
  const feedUrl = options.feedUrl || siteRoute`/feed/atom`;
  const authorUri = siteRoute``;

  const entriesXml = items
    .map(
      (item) => `  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${escapeXml(item.url)}" rel="alternate" type="text/html"/>
    ${item.attachments?.map((attachment) => `<link rel="enclosure" href="${escapeXml(attachment.url)}" type="${escapeXml(attachment.mime_type)}"${attachment.size_in_bytes === undefined ? '' : ` length="${attachment.size_in_bytes}"`}/>`).join('') || ''}
    <id>${escapeXml(item.id || item.url)}</id>
    <published>${formatAtomDate(item.published)}</published>
    <updated>${formatAtomDate(item.updated || item.published)}</updated>
    <summary>${escapeXml(item.description)}</summary>
    ${item.content ? `<content type="html">${escapeXml(item.content)}</content>` : ''}
    <author>
      <name>${escapeXml(item.author?.name || AUTHOR_NAME)}</name>
      ${item.author ? '' : `<email>${escapeXml(AUTHOR_EMAIL)}</email>`}
      <uri>${escapeXml(item.author?.url || authorUri)}</uri>
    </author>
    ${item.categories?.map((cat) => `<category term="${escapeXml(cat)}"/>`).join('\n    ') || ''}
  </entry>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(title)}</title>
  <subtitle>${escapeXml(subtitle)}</subtitle>
  <link href="${escapeXml(alternateUrl)}" rel="alternate" type="text/html"/>
  <link href="${escapeXml(feedUrl)}" rel="self" type="application/atom+xml"/>
  <link href="${escapeXml(WEBSUB_HUB)}" rel="hub"/>
  <id>${escapeXml(feedUrl)}</id>
  <updated>${formatAtomDate(latestFeedDate(items))}</updated>
  <author>
    <name>${escapeXml(AUTHOR_NAME)}</name>
    <email>${escapeXml(AUTHOR_EMAIL)}</email>
    <uri>${escapeXml(authorUri)}</uri>
  </author>
${entriesXml}
</feed>`;
}

/**
 * Generate the writings Atom feed, which describes and links to /writings
 * rather than the whole site.
 */
export function generateWritingsAtomFeed(items: FeedItem[]): string {
  return generateAtomFeed(items, {
    title: WRITINGS_TITLE,
    subtitle: WRITINGS_DESCRIPTION,
    alternateUrl: siteRoute`/writings`,
    feedUrl: siteRoute`/writings/feed/atom`,
  });
}

/** Generate the writings RSS feed, which describes and links to /writings. */
export function generateWritingsRssFeed(items: FeedItem[]): string {
  return generateRssFeed(items, {
    title: WRITINGS_TITLE,
    description: WRITINGS_DESCRIPTION,
    alternateUrl: siteRoute`/writings`,
    feedUrl: siteRoute`/writings/feed.xml`,
  });
}

/** Generate the writings JSON Feed, which describes and links to /writings. */
export function generateWritingsJsonFeed(items: FeedItem[]): string {
  return generateJsonFeed(items, {
    title: WRITINGS_TITLE,
    description: WRITINGS_DESCRIPTION,
    alternateUrl: siteRoute`/writings`,
    feedUrl: siteRoute`/writings/feed/json`,
  });
}

/** What a tag's three feeds share: their name and the page they mirror. */
function tagFeedOptions(tag: string) {
  const name = normalizeTag(tag);
  return {
    title: `${WRITINGS_TITLE}: #${name}`,
    description: `Writings tagged ${name} from ${AUTHOR_NAME}.`,
    alternateUrl: siteRoute`${tagPath(tag)}`,
  };
}

/** Generate a tag's RSS feed, which describes and links to its page. */
export function generateTagRssFeed(tag: string, items: FeedItem[]): string {
  return generateRssFeed(items, {
    ...tagFeedOptions(tag),
    feedUrl: siteRoute`${tagFeedPaths(tag).rss}`,
  });
}

/** Generate a tag's Atom feed, which describes and links to its page. */
export function generateTagAtomFeed(tag: string, items: FeedItem[]): string {
  const { title, description, alternateUrl } = tagFeedOptions(tag);
  return generateAtomFeed(items, {
    title,
    subtitle: description,
    alternateUrl,
    feedUrl: siteRoute`${tagFeedPaths(tag).atom}`,
  });
}

/** Generate a tag's JSON Feed, which describes and links to its page. */
export function generateTagJsonFeed(tag: string, items: FeedItem[]): string {
  return generateJsonFeed(items, {
    ...tagFeedOptions(tag),
    feedUrl: siteRoute`${tagFeedPaths(tag).json}`,
  });
}

/**
 * Generate a JSON Feed 1.1.
 */
export function generateJsonFeed(
  items: FeedItem[],
  options: JsonFeedOptions = {}
): string {
  const title = options.title || SITE_TITLE;
  const description = options.description || SITE_DESCRIPTION;
  const siteUrl = siteRoute``;
  const alternateUrl = options.alternateUrl || siteUrl;
  const feedUrl = options.feedUrl || siteRoute`/feed/json`;

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title,
    home_page_url: alternateUrl,
    feed_url: feedUrl,
    description,
    language: 'en-US',
    hubs: [{ type: 'WebSub', url: WEBSUB_HUB }],
    authors: [
      {
        name: AUTHOR_NAME,
        url: siteUrl,
      },
    ],
    items: items.map((item) => ({
      id: item.id || item.url,
      url: item.url,
      title: item.title,
      summary: item.description,
      ...(item.content
        ? { content_html: item.content }
        : { content_text: item.description }),
      date_published: item.published.toISOString(),
      date_modified: item.updated?.toISOString(),
      tags: item.categories,
      _indieweb: item.indieweb,
      ...(item.author && {
        authors: [
          {
            name: item.author.name,
            url: item.author.url,
            avatar: item.author.photo,
          },
        ],
      }),
      ...(item.attachments?.length && { attachments: item.attachments }),
    })),
  };

  return JSON.stringify(feed, null, 2);
}

export function generateActivityRssFeed(
  items: ActivityFeedItem[],
  options: ActivityRssFeedOptions
): string {
  // Readers render an RSS description as HTML, and an activity's description
  // is a stranger's plain text, so it is escaped once as HTML before the
  // generator escapes it again as XML. Atom and JSON Feed read it as text.
  const asHtml = items.map((item) => ({
    ...item,
    description: escapeXml(item.description),
  }));
  return generateRssFeed(asHtml, {
    title: options.title,
    description: options.description,
    feedUrl: options.feedUrl,
  });
}

export function generateActivityAtomFeed(
  items: ActivityFeedItem[],
  options: ActivityAtomFeedOptions
): string {
  return generateAtomFeed(items, {
    title: options.title,
    subtitle: options.subtitle,
    feedUrl: options.feedUrl,
    alternateUrl: options.alternateUrl,
  });
}

export function generateActivityJsonFeed(
  items: ActivityFeedItem[],
  options: ActivityJsonFeedOptions
): string {
  return generateJsonFeed(items, {
    title: options.title,
    description: options.description,
    feedUrl: options.feedUrl,
  });
}
