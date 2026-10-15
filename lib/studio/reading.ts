import readingTime from 'reading-time';
import sanitizeHtml from 'sanitize-html';

import { renderFeedHtml } from '@/lib/indieweb/feeds/html';
import type { WritingData } from '@/lib/writings';
import { writingText } from '@/lib/writings/content';

import { documentSource } from './document';
import type { Draft } from './types';

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
  series?: { slug: string; part: number };
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
    const body = draft.head.body;
    const existing = items.get(draft.slug);
    const source = documentSource(body.document);
    const plain = writingText(source, {}).replace(/\s+/g, ' ').trim();
    const sentence = plain.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? plain;
    const derivedTitle =
      sentence.length > 120 ? `${sentence.slice(0, 117).trimEnd()}…` : sentence;
    items.set(draft.slug, {
      slug: draft.slug,
      title: body.title.trim() || derivedTitle || 'Untitled note',
      hasExplicitTitle: Boolean(body.title.trim()),
      description: body.description,
      tags: body.tags,
      date: date(
        body.frontmatter?.published,
        existing?.date ?? new Date(draft.head.createdAt)
      ),
      postType: body.postType,
      status:
        draft.head.id === draft.liveRevisionId
          ? null
          : draft.liveRevisionId || (existing && !existing.status)
            ? 'Unpublished changes'
            : 'Draft',
      editorId: draft.id,
      source,
      series:
        existing?.series ??
        (body.frontmatter?.series as ReadingEntry['series']),
    });
  }
  return [...items.values()].sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
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
