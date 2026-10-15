import readingTime from 'reading-time';
import sanitizeHtml from 'sanitize-html';

import { renderFeedHtml } from '@/lib/indieweb/feeds/html';
import type { WritingData } from '@/lib/writings';
import { writingText } from '@/lib/writings/content';

import { documentSource } from './document';
import type { Draft } from './types';

interface ReadingSeries {
  slug: string;
  part: number;
}

export interface ReadingEntry {
  slug: string;
  title: string;
  hasExplicitTitle?: boolean;
  description: string;
  tags: string[];
  date: Date;
  postType: 'article' | 'note';
  status: 'Draft' | 'Unpublished changes' | null;
  editorId?: string;
  source?: string;
  series?: ReadingSeries;
}

function date(value: unknown, fallback: Date): Date {
  const candidate = new Date(value as string);
  return Number.isNaN(candidate.getTime()) ? fallback : candidate;
}

/** Pure overlay: private revision heads replace matching filesystem entries. */
export function overlayReadings(
  writings: WritingData[],
  drafts: Draft[]
): ReadingEntry[] {
  const items = new Map<string, ReadingEntry>(
    writings.map((writing) => [
      writing.slug,
      {
        slug: writing.slug,
        title: writing.title,
        hasExplicitTitle: writing.hasExplicitTitle,
        description: writing.description,
        tags: writing.tags,
        date: new Date(writing.published),
        postType: writing.hasExplicitTitle ? 'article' : 'note',
        status: writing.draft ? 'Draft' : null,
        series: writing.series,
      },
    ])
  );
  for (const draft of drafts) {
    if (draft.deletedAt) continue;
    items.set(draft.slug, draftReadingEntry(draft, items.get(draft.slug)));
  }
  return [...items.values()].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
}

function draftReadingStatus(
  draft: Draft,
  existing?: ReadingEntry
): ReadingEntry['status'] {
  if (draft.head.id === draft.liveRevisionId) return null;
  return draft.liveRevisionId || (existing && !existing.status)
    ? 'Unpublished changes'
    : 'Draft';
}
function draftReadingEntry(
  draft: Draft,
  existing?: ReadingEntry
): ReadingEntry {
  const body = draft.head.body;

  const source = documentSource(body.document);
  return {
    slug: draft.slug,
    title: body.title.trim() || derivedReadingTitle(source),
    hasExplicitTitle: Boolean(body.title.trim()),
    description: body.description,
    tags: body.tags,
    date: date(
      body.frontmatter?.published,
      existing?.date ?? new Date(draft.head.createdAt)
    ),
    postType: body.postType,
    status: draftReadingStatus(draft, existing),
    editorId: draft.id,
    source,
    series:
      existing?.series ?? (body.frontmatter?.series as ReadingEntry['series']),
  };
}

function derivedReadingTitle(source: string): string {
  const plain = writingText(source, {}).replace(/\s+/g, ' ').trim();
  const sentence = plain.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? plain;
  const derivedTitle =
    sentence.length > 120 ? `${sentence.slice(0, 117).trimEnd()}…` : sentence;

  return derivedTitle || 'Untitled note';
}

/** Adapt overlay metadata to the same header and index cards as the public site. */
export function readingWritingData(
  entry: ReadingEntry,
  original?: WritingData
): WritingData {
  return {
    people: [],
    featured: false,
    readingTime: 0,
    ...original,
    slug: entry.slug,
    title: entry.title,
    description: entry.description,
    published: entry.date,
    lastUpdated: entry.date,
    tags: entry.tags,
    draft: entry.status === 'Draft',
    hasExplicitTitle: entry.editorId
      ? entry.postType === 'article' && entry.hasExplicitTitle !== false
      : (entry.hasExplicitTitle ??
        original?.hasExplicitTitle ??
        entry.postType === 'article'),
    postType: entry.editorId
      ? entry.postType
      : (original?.postType ?? entry.postType),
    series: entry.series,
    ...(entry.source !== undefined && {
      readingTime: Math.ceil(
        readingTime(writingText(entry.source, {})).minutes
      ),
    }),
  };
}

/** Private prose never goes through an MDX evaluator, even for imported source. */
export async function safeReadingHtml(
  source: string,
  path: string
): Promise<string> {
  const html = await renderFeedHtml(source, path);
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      'img',
      'figure',
      'figcaption',
      'aside',
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title', 'width', 'height'],
      '*': ['id'],
    },
    allowedSchemes: ['https', 'http', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', {
        rel: 'noopener noreferrer',
        'data-preview': 'false',
      }),
    },
  });
}
