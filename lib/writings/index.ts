import { cache } from 'react';

import { showDrafts } from '@/lib/content/visibility';

import { getWritingSlugs, loadAllWritingMetadata, loadWriting } from './load';
import { type TagGroup, groupByTag, normalizeTag } from './tags';
import type { WritingData } from './types';

export type { SeriesDefinition, SeriesWithWritings } from '../collections';
export type { TOCHeading, WritingData, WritingDocument } from './types';

/**
 * Fetches the data for a writing.
 *
 * @param slug The UID of the writing.
 * @returns The corresponding writing data and MDX source.
 */
export const getWriting = loadWriting;

export { showDrafts };

/**
 * One writing, or a thrown error when it is a draft and drafts are not
 * shown. Everything that serves a writing by its slug goes through this,
 * so a draft never leaks through a page, an image, or an embed.
 */
export async function getPublishedWriting(slug: string) {
  // Check membership before loading so reserved and hidden slugs stay missing.
  if (!(await getWritingSlugs()).includes(slug)) {
    throw new Error(`No writing "${slug}"`);
  }
  const data = await getWriting(slug);
  if (data.writing.draft) {
    throw new Error(`Writing "${slug}" is a draft`);
  }
  return data;
}

/** Slugs of the writings a visitor can open. */
export async function getPublishedWritingSlugs(): Promise<string[]> {
  const writings = await getAllWritings();
  return writings.map((writing) => writing.slug);
}

/**
 * Gets all writings, optionally filtering by draft status.
 *
 * @param includeDrafts Whether to include draft posts (defaults to false in production)
 * @returns All writings sorted by publication date (newest first)
 */
export const getAllWritings = cache(
  async (includeDrafts = showDrafts): Promise<WritingData[]> => {
    const writings = await loadAllWritingMetadata();

    return writings
      .filter((writing) => includeDrafts || !writing.draft)
      .sort(
        (a, b) =>
          new Date(b.published).getTime() - new Date(a.published).getTime()
      );
  }
);

/**
 * Gets writings that contain a specific tag.
 */
export async function getWritingsByTag(tag: string): Promise<WritingData[]> {
  const writings = await getAllWritings();
  const wanted = normalizeTag(tag);
  return writings.filter((writing) =>
    writing.tags.some((t) => normalizeTag(t) === wanted)
  );
}

/**
 * A tag and the writings a visitor can open that carry it, or null when
 * there are none, which is how a tag page or feed knows to answer 404.
 */
export async function getTagGroup(tag: string): Promise<TagGroup | null> {
  const writings = await getWritingsByTag(tag);
  return writings.length > 0 ? { tag: normalizeTag(tag), writings } : null;
}

/**
 * The `[tag]` params for every tag page and feed. Cache Components refuses
 * an empty list at build time, so when nothing is published one underscore
 * stands in: no writing carries it, and it prerenders as a plain 404.
 */
export async function getTagParams(): Promise<Array<{ tag: string }>> {
  const tags = await getAllTags();
  return tags.length > 0 ? tags.map((tag) => ({ tag })) : [{ tag: '_' }];
}

/**
 * Gets all unique tags across all writings, lowercase and sorted.
 */
export async function getAllTags(): Promise<string[]> {
  return groupByTag(await getAllWritings()).map((group) => group.tag);
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
    .sort((a, b) => (a.series?.part ?? 0) - (b.series?.part ?? 0));
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
