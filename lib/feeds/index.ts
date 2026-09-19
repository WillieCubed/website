import { WEBSUB_HUB } from '@/lib/indieweb/constants';
import type { ActivityFeedItem } from '@/lib/indieweb/types';
import { site } from '@/lib/site';
import { siteRoute } from '@/lib/url-utils';
import type { WritingData } from '@/lib/writings';

const SITE_TITLE = site.name;
const SITE_DESCRIPTION = site.description;
const AUTHOR_NAME = site.author.name;
const AUTHOR_EMAIL = site.author.email;

export interface FeedItem {
  id?: string;
  title: string;
  description: string;
  url: string;
  published: Date;
  updated?: Date;
  categories?: string[];
  indieweb?: ActivityFeedItem['indieweb'];
}

export interface RssFeedOptions {
  title?: string;
  description?: string;
  feedUrl?: string;
}

export interface AtomFeedOptions {
  title?: string;
  subtitle?: string;
  feedUrl?: string;
}

export interface JsonFeedOptions {
  title?: string;
  description?: string;
  feedUrl?: string;
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
}

export interface ActivityJsonFeedOptions {
  title: string;
  description: string;
  feedUrl: string;
}

/**
 * Convert a writing to a feed item.
 */
export function writingToFeedItem(writing: WritingData): FeedItem {
  return {
    title: writing.title,
    description: writing.description,
    url: siteRoute`/writings/${writing.slug}`,
    published: new Date(writing.published),
    updated: writing.lastUpdated ? new Date(writing.lastUpdated) : undefined,
    categories: writing.tags,
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

function latestFeedDate(items: FeedItem[]): Date {
  return (
    items
      .map((item) => item.updated || item.published)
      .sort((a, b) => b.getTime() - a.getTime())[0] || new Date(0)
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
  const siteUrl = siteRoute``;
  const feedUrl = options.feedUrl || siteRoute`/feed.xml`;

  const itemsXml = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.url}</link>
      <guid isPermaLink="${item.id ? 'false' : 'true'}">${escapeXml(item.id || item.url)}</guid>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${formatRssDate(item.published)}</pubDate>
      ${item.categories?.map((cat) => `<category>${escapeXml(cat)}</category>`).join('\n      ') || ''}
    </item>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(description)}</description>
    <language>en-us</language>
    <lastBuildDate>${formatRssDate(latestFeedDate(items))}</lastBuildDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>
    <atom:link href="${WEBSUB_HUB}" rel="hub"/>
    <managingEditor>${AUTHOR_EMAIL} (${AUTHOR_NAME})</managingEditor>
    <webMaster>${AUTHOR_EMAIL} (${AUTHOR_NAME})</webMaster>
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
  const siteUrl = siteRoute``;
  const feedUrl = options.feedUrl || siteRoute`/feed/atom`;
  const authorUri = siteRoute``;

  const entriesXml = items
    .map(
      (item) => `  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${item.url}" rel="alternate" type="text/html"/>
    <id>${escapeXml(item.id || item.url)}</id>
    <published>${formatAtomDate(item.published)}</published>
    <updated>${formatAtomDate(item.updated || item.published)}</updated>
    <summary>${escapeXml(item.description)}</summary>
    <author>
      <name>${AUTHOR_NAME}</name>
      <email>${AUTHOR_EMAIL}</email>
      <uri>${authorUri}</uri>
    </author>
    ${item.categories?.map((cat) => `<category term="${escapeXml(cat)}"/>`).join('\n    ') || ''}
  </entry>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(title)}</title>
  <subtitle>${escapeXml(subtitle)}</subtitle>
  <link href="${siteUrl}" rel="alternate" type="text/html"/>
  <link href="${feedUrl}" rel="self" type="application/atom+xml"/>
  <link href="${WEBSUB_HUB}" rel="hub"/>
  <id>${siteUrl}/</id>
  <updated>${formatAtomDate(latestFeedDate(items))}</updated>
  <author>
    <name>${AUTHOR_NAME}</name>
    <email>${AUTHOR_EMAIL}</email>
    <uri>${authorUri}</uri>
  </author>
${entriesXml}
</feed>`;
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
  const feedUrl = options.feedUrl || siteRoute`/feed/json`;

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title,
    home_page_url: siteUrl,
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
      date_published: item.published.toISOString(),
      date_modified: item.updated?.toISOString(),
      tags: item.categories,
      _indieweb: item.indieweb,
    })),
  };

  return JSON.stringify(feed, null, 2);
}

export function generateActivityRssFeed(
  items: ActivityFeedItem[],
  options: ActivityRssFeedOptions
): string {
  return generateRssFeed(items, {
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
