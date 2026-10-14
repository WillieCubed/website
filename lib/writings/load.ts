import matter from 'gray-matter';
import { join } from 'node:path';
import readingTime from 'reading-time';

import { hasImageDescription } from '@/lib/accessibility/alt-policy';
import { parseDocumentMetadata } from '@/lib/atproto/metadata';
import { markdownFiles, readMarkdownFile } from '@/lib/content/files';
import { RESERVED_WRITING_SLUGS } from '@/lib/indieweb/utils';

import { writingText } from './content';
import { parsePersonTags } from './person-tags';
import type {
  PostType,
  RSVPData,
  SyndicationLink,
  TOCHeading,
  WritingData,
  WritingPhoto,
} from './types';

const writingsDirectory = join(process.cwd(), 'content/writings');

interface RawFrontmatter {
  /** Optional for notes and interaction posts; derived from the body when absent. */
  title?: string;
  description?: string;
  /** A string unless the YAML is a full timestamp with seconds. */
  published: Date | string;
  lastUpdated?: Date | string;
  tags?: string[];
  /** People tagged in the post, each `{ name, url }`. */
  people?: unknown;
  draft?: boolean;
  /** Surfaces the writing wherever featured writings are listed. */
  featured?: boolean;
  featuredImage?: string;
  featuredImageAlt?: string;
  series?: {
    slug: string;
    part: number;
  };
  syndication?: SyndicationLink[];
  syndicateTo?: unknown;
  atproto?: unknown;
  contentFormat?: 'text' | 'html';
  micropub?: WritingData['micropub'];
  audio?: string[];
  video?: string[];
  event?: WritingData['event'];
  location?: unknown;
  /** Photos, each `{ url, alt }`, as the Micropub endpoint writes them. */
  photo?: unknown;
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
  const slugs = markdownFiles(writingsDirectory)
    .map((file) => file.replace(/\.mdx?$/, ''))
    .filter((slug) => {
      if (RESERVED_WRITING_SLUGS.has(slug)) {
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
  return readMarkdownFile(
    writingsDirectory,
    slug,
    `Writing with given codename "${slug}" cannot be found.`
  );
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
 * Read a writing's source and derive its metadata, text statistics, and headings.
 */
export async function loadWriting(slug: string) {
  const slugs = await getWritingSlugs();
  if (!slugs.includes(slug)) {
    throw new Error(`Writing with given codename "${slug}" cannot be found.`);
  }

  const { source } = readWritingFile(slug);
  const fileContent = source.toString();

  // Parse frontmatter using gray-matter
  const { data, content } = matter(fileContent);
  const frontmatter = data as RawFrontmatter;

  const stats = readingTime(
    writingText(content, { contentFormat: frontmatter.contentFormat })
  );
  const headings = frontmatter.contentFormat ? [] : extractHeadings(content);

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

  const people = parsePersonTags(frontmatter.people);
  if (
    process.env.NODE_ENV !== 'production' &&
    Array.isArray(frontmatter.people) &&
    frontmatter.people.length !== people.length
  ) {
    console.warn(
      `Warning: Post "${slug}" has people entries without a name and an absolute URL, or repeated URLs; they were skipped`
    );
  }

  const derivedTitle = deriveTitle(frontmatter, content);
  const writing: WritingData = {
    slug,
    title: derivedTitle.title,
    hasExplicitTitle: derivedTitle.explicit,
    description: frontmatter.description ?? derivedTitle.title,
    published: new Date(frontmatter.published),
    lastUpdated: new Date(frontmatter.lastUpdated ?? frontmatter.published),
    tags: frontmatter.tags || [],
    people,
    draft: frontmatter.draft ?? false,
    featured: frontmatter.featured ?? false,
    featuredImage: frontmatter.featuredImage,
    featuredImageAlt: frontmatter.featuredImageAlt,
    readingTime: Math.ceil(stats.minutes),
    series: frontmatter.series,
    syndication: frontmatter.syndication,
    syndicateTo: Array.isArray(frontmatter.syndicateTo)
      ? frontmatter.syndicateTo.filter(
          (value): value is string =>
            typeof value === 'string' && value.length > 0
        )
      : undefined,
    atproto: parseDocumentMetadata(frontmatter.atproto),
    contentFormat: frontmatter.contentFormat,
    micropub: frontmatter.micropub,
    audio: frontmatter.audio,
    video: frontmatter.video,
    event: frontmatter.event,
    location: frontmatter.location,
    photos: parsePhotos(frontmatter.photo),
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
 * `photo` frontmatter as a list of photos with descriptions.
 */
function parsePhotos(value: unknown): WritingPhoto[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const photos = value.flatMap((item: unknown): WritingPhoto[] => {
    if (!item || typeof item !== 'object') {
      throw new Error('A writing photo needs a URL and nonblank alt text.');
    }
    const { url, alt } = item as { url?: unknown; alt?: unknown };
    if (typeof url !== 'string' || !url || !hasImageDescription(alt)) {
      throw new Error('A writing photo needs a URL and nonblank alt text.');
    }
    return [{ url, alt: alt.trim() }];
  });
  return photos.length > 0 ? photos : undefined;
}

/**
 * Notes, replies, likes, and the other short post kinds have no headline in
 * IndieWeb terms, so their frontmatter may omit `title`. The first sentence
 * of the body stands in for feeds, metadata, and the writings index.
 */
function deriveTitle(
  frontmatter: RawFrontmatter,
  content: string
): { title: string; explicit: boolean } {
  const explicit = frontmatter.title?.trim();
  if (explicit) return { title: explicit, explicit: true };

  const plain = writingText(content, {
    contentFormat: frontmatter.contentFormat,
  })
    .replace(/\s+/g, ' ')
    .trim();
  const sentence = plain.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? plain;
  const title =
    sentence.length > 120 ? `${sentence.slice(0, 117).trimEnd()}…` : sentence;
  return { title: title || 'Untitled note', explicit: false };
}
