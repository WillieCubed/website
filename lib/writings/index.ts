import matter from 'gray-matter';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import readingTime from 'reading-time';

// =============================================================================
// Series functions - delegating to collections module
// =============================================================================

import {
  type SeriesDefinition,
  type SeriesWithWritings,
  getAllSeries as _getAllSeries,
  getAllSeriesWithWritings as _getAllSeriesWithWritings,
  getSeries as _getSeries,
  getSeriesSlugs as _getSeriesSlugs,
  getSeriesWithWritings as _getSeriesWithWritings,
} from '../collections';
import { fetchConfig } from '../config';
import type {
  PostType,
  RSVPData,
  SyndicationLink,
  TOCHeading,
  WritingData,
} from './types';

// Re-export series types from collections module
export type {
  SeriesDefinition,
  SeriesWithWritings,
  SeriesMetadata,
} from '../collections';

// Re-export local types
export type { WritingData, TOCHeading };

const HIDDEN_ITEM_PREFIX = '_';

/** Slugs that conflict with routes under /writings/ */
const RESERVED_WRITING_SLUGS = ['series'];

const writingsDirectory = join(process.cwd(), 'content/writings');

interface RawFrontmatter {
  title: string;
  description: string;
  published: Date;
  lastUpdated: Date;
  tags?: string[];
  draft?: boolean;
  featuredImage?: string;
  featuredImageAlt?: string;
  series?: {
    slug: string;
    part: number;
  };
  syndication?: SyndicationLink[];
  postType?: PostType;
  inReplyTo?: string;
  // Interaction post fields (IndieWeb Level 4)
  likeOf?: string;
  repostOf?: string;
  bookmarkOf?: string;
  rsvp?: RSVPData;
}

/**
 * Fetches the slugs of all writings.
 *
 * All writings must be markdown files. This excludes any files that are hidden
 * (i.e. start with an underscore {@see HIDDEN_ITEM_PREFIX }).
 *
 * @returns The codenames of all non-hidden projects
 */
export async function getWritingSlugs(): Promise<string[]> {
  const slugs = readdirSync(writingsDirectory)
    .filter((file) => file.endsWith('.mdx') || file.endsWith('.md'))
    .filter((file) => !file.startsWith(HIDDEN_ITEM_PREFIX))
    .map((file) => file.replace(/\.mdx?$/, ''))
    .filter((slug) => {
      if (RESERVED_WRITING_SLUGS.includes(slug)) {
        console.warn(
          `Warning: Writing slug "${slug}" conflicts with a reserved route and will be ignored.`
        );
        return false;
      }
      return true;
    });
  return slugs;
}

/**
 * Reads the raw content of a writing file.
 */
export function readWritingFile(slug: string): {
  source: Buffer;
  filePath: string;
} {
  const mdxPath = join(writingsDirectory, `${slug}.mdx`);
  try {
    return { source: readFileSync(mdxPath), filePath: mdxPath };
  } catch {
    const mdPath = join(writingsDirectory, `${slug}.md`);
    try {
      return { source: readFileSync(mdPath), filePath: mdPath };
    } catch {
      throw new Error(`Writing with given codename "${slug}" cannot be found.`);
    }
  }
}

/**
 * Extracts headings from markdown content for table of contents.
 */
export function extractHeadings(content: string): TOCHeading[] {
  const headingRegex = /^(#{2,4})\s+(.+)$/gm;
  const headings: TOCHeading[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = match[1].length as 2 | 3 | 4;
    const text = match[2].trim();
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    headings.push({ id, text, level });
  }

  return headings;
}

/**
 * Fetches the data for a writing.
 *
 * @param slug The UID of the writing.
 * @returns The corresponding writing data and MDX source.
 */
export async function getWriting(slug: string) {
  const slugs = await getWritingSlugs();
  if (!slugs.includes(slug)) {
    throw new Error(`Writing with given codename "${slug}" cannot be found.`);
  }

  const { source } = readWritingFile(slug);
  const fileContent = source.toString();

  // Parse frontmatter using gray-matter
  const { data, content } = matter(fileContent);
  const frontmatter = data as RawFrontmatter;

  const stats = readingTime(fileContent);
  const headings = extractHeadings(content);

  // Infer postType from interaction fields if not explicitly set
  let postType: PostType = frontmatter.postType ?? 'article';
  if (!frontmatter.postType) {
    if (frontmatter.likeOf) postType = 'like';
    else if (frontmatter.repostOf) postType = 'repost';
    else if (frontmatter.bookmarkOf) postType = 'bookmark';
    else if (frontmatter.rsvp) postType = 'rsvp';
  }

  // Validate that interaction fields match declared postType
  if (process.env.NODE_ENV !== 'production') {
    const hasLikeOf = !!frontmatter.likeOf;
    const hasRepostOf = !!frontmatter.repostOf;
    const hasBookmarkOf = !!frontmatter.bookmarkOf;
    const hasRsvp = !!frontmatter.rsvp;

    if (postType === 'like' && !hasLikeOf) {
      console.warn(
        `Warning: Post "${slug}" has postType 'like' but missing likeOf field`
      );
    }
    if (postType === 'repost' && !hasRepostOf) {
      console.warn(
        `Warning: Post "${slug}" has postType 'repost' but missing repostOf field`
      );
    }
    if (postType === 'bookmark' && !hasBookmarkOf) {
      console.warn(
        `Warning: Post "${slug}" has postType 'bookmark' but missing bookmarkOf field`
      );
    }
    if (postType === 'rsvp' && !hasRsvp) {
      console.warn(
        `Warning: Post "${slug}" has postType 'rsvp' but missing rsvp field`
      );
    }
  }

  const writing: WritingData = {
    slug,
    title: frontmatter.title,
    description: frontmatter.description,
    published: frontmatter.published,
    lastUpdated: frontmatter.lastUpdated,
    tags: frontmatter.tags || [],
    draft: frontmatter.draft ?? false,
    featuredImage: frontmatter.featuredImage,
    featuredImageAlt: frontmatter.featuredImageAlt,
    readingTime: Math.ceil(stats.minutes),
    series: frontmatter.series,
    syndication: frontmatter.syndication,
    postType,
    inReplyTo: frontmatter.inReplyTo,
    // Interaction post fields
    likeOf: frontmatter.likeOf,
    repostOf: frontmatter.repostOf,
    bookmarkOf: frontmatter.bookmarkOf,
    rsvp: frontmatter.rsvp,
  };

  return { content, writing, headings };
}

/**
 * Gets all writings, optionally filtering by draft status.
 *
 * @param includeDrafts Whether to include draft posts (defaults to false in production)
 * @returns All writings sorted by publication date (newest first)
 */
export async function getAllWritings(
  includeDrafts = process.env.NODE_ENV !== 'production'
): Promise<WritingData[]> {
  const slugs = await getWritingSlugs();
  const writings = await Promise.all(
    slugs.map(async (slug) => {
      const { writing } = await getWriting(slug);
      return writing;
    })
  );

  return writings
    .filter((writing) => includeDrafts || !writing.draft)
    .sort(
      (a, b) =>
        new Date(b.published).getTime() - new Date(a.published).getTime()
    );
}

/**
 * Gets writings that contain a specific tag.
 */
export async function getWritingsByTag(tag: string): Promise<WritingData[]> {
  const writings = await getAllWritings();
  return writings.filter((writing) =>
    writing.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())
  );
}

/**
 * Gets all unique tags across all writings.
 */
export async function getAllTags(): Promise<string[]> {
  const writings = await getAllWritings();
  const tagSet = new Set<string>();
  for (const writing of writings) {
    for (const tag of writing.tags) {
      tagSet.add(tag.toLowerCase());
    }
  }
  return Array.from(tagSet).sort();
}

/**
 * Gets all writings in a series by slug, ordered by part number.
 */
export async function getWritingsInSeries(
  seriesSlug: string
): Promise<WritingData[]> {
  const writings = await getAllWritings();
  return writings
    .filter((writing) => writing.series?.slug === seriesSlug)
    .sort((a, b) => (a.series?.part || 0) - (b.series?.part || 0));
}

/**
 * Fetches all series slugs.
 */
export async function getSeriesSlugs(): Promise<string[]> {
  return _getSeriesSlugs();
}

/**
 * Gets a series definition by slug.
 */
export async function getSeries(slug: string): Promise<SeriesDefinition> {
  return _getSeries(slug);
}

/**
 * Gets all series definitions.
 */
export async function getAllSeries(): Promise<SeriesDefinition[]> {
  return _getAllSeries();
}

/**
 * Gets a series with all its writings.
 */
export async function getSeriesWithWritings(
  slug: string
): Promise<SeriesWithWritings> {
  return _getSeriesWithWritings(slug, getWritingsInSeries);
}

/**
 * Gets all series with their writings.
 */
export async function getAllSeriesWithWritings(): Promise<
  SeriesWithWritings[]
> {
  return _getAllSeriesWithWritings(getWritingsInSeries);
}

/**
 * Gets the series name for a given slug.
 * Returns the slug if series not found.
 */
export async function getSeriesName(slug: string): Promise<string> {
  try {
    const series = await getSeries(slug);
    return series.name;
  } catch {
    return slug;
  }
}

/**
 * Gets featured writings based on config.
 */
export async function getFeaturedWritings(): Promise<WritingData[]> {
  const featuredListConfig = await fetchConfig('featured_writings');
  if (!featuredListConfig) {
    return [];
  }
  const writings = await getAllWritings();
  const featuredWritings = writings.filter((writing) => {
    return (featuredListConfig as string[]).includes(writing.slug);
  });
  return featuredWritings;
}

/**
 * Gets the previous and next writings relative to a given writing.
 * Uses chronological order (sorted by published date, newest first).
 *
 * @param currentSlug The slug of the current writing
 * @returns Object with previous (older) and next (newer) writings, or null if at boundary
 */
export async function getAdjacentWritings(currentSlug: string): Promise<{
  previous: WritingData | null;
  next: WritingData | null;
}> {
  const allWritings = await getAllWritings();
  const currentIndex = allWritings.findIndex((w) => w.slug === currentSlug);

  if (currentIndex === -1) {
    return { previous: null, next: null };
  }

  return {
    // Previous = older post (higher index since sorted newest first)
    previous:
      currentIndex < allWritings.length - 1
        ? allWritings[currentIndex + 1]
        : null,
    // Next = newer post (lower index)
    next: currentIndex > 0 ? allWritings[currentIndex - 1] : null,
  };
}
