import { getInitiative, initiativeExists } from '../initiatives/index';
import type { WritingData } from '../writings/types';
import {
  type CollectionTypeConfig,
  getCollectionDefinition,
  getCollectionSlugs,
} from './load';

/** Metadata shape for series collections */
export interface SeriesMetadata {
  complete: boolean;
  startedAt?: string;
  [key: string]: unknown; // Index signature for Record<string, unknown> compatibility
}

/** Series collection configuration */
const seriesConfig: CollectionTypeConfig<SeriesMetadata> = {
  parseMetadata: (frontmatter) => ({
    complete: (frontmatter.complete as boolean) ?? false,
    startedAt: frontmatter.startedAt as string | undefined,
  }),
  getCreatedAt: (frontmatter) =>
    (frontmatter.startedAt as string) || new Date().toISOString(),
};

/**
 * Series definition as stored in MDX (before writings are loaded).
 * Maintains backward compatibility with the old type shape.
 */
export interface SeriesDefinition {
  slug: string;
  name: string;
  description: string;
  coverImage?: string;
  /** When the series was started */
  startedAt?: string;
  /** Whether the series is complete */
  complete?: boolean;
  /** MDX content for series landing page */
  content: string;
  /** Where the series name links. Initiatives own their page. */
  href: string;
}

/**
 * Series with its associated writings and computed metadata.
 * Maintains backward compatibility with the old type shape.
 */
export interface SeriesWithWritings extends SeriesDefinition {
  writings: WritingData[];
  /** Computed from writings count */
  totalParts: number;
}

/**
 * Gets all series slugs.
 */
export async function getSeriesSlugs(): Promise<string[]> {
  return getCollectionSlugs('series');
}

/**
 * Gets a series definition by slug.
 * Returns the backward-compatible shape.
 */
export async function getSeries(slug: string): Promise<SeriesDefinition> {
  // A writing's series slug can name an initiative instead of a standalone
  // series, so writings about Superbloom land on
  // /initiatives/superbloom rather than a collections page that does not
  // exist.
  const initiative = (await initiativeExists(slug))
    ? await getInitiative(slug)
    : null;
  const hasFile = (await getCollectionSlugs('series')).includes(slug);
  if (!hasFile && initiative) {
    return {
      slug,
      name: initiative.title,
      description: initiative.description,
      coverImage: initiative.cover?.src,
      startedAt: initiative.starts?.toISOString(),
      complete: initiative.status === 'complete',
      content: initiative.content,
      href: initiative.href,
    };
  }

  const definition = await getCollectionDefinition(
    'series',
    slug,
    seriesConfig
  );

  // Convert to backward-compatible shape
  return {
    slug: definition.slug,
    name: definition.name,
    description: definition.description,
    coverImage: definition.coverImage,
    startedAt: definition.metadata.startedAt,
    complete: definition.metadata.complete,
    content: definition.content,
    // The writings index ignores ?series=, so that href only lands on the
    // unfiltered list. An initiative with the same slug owns the real page,
    // even when the series also has a file of its own.
    href: initiative?.href ?? `/writings?series=${definition.slug}`,
  };
}

/**
 * Gets all series definitions.
 */
export async function getAllSeries(): Promise<SeriesDefinition[]> {
  const slugs = await getSeriesSlugs();
  return Promise.all(slugs.map((slug) => getSeries(slug)));
}

/**
 * Gets a series with all its writings loaded.
 * The caller supplies the writing loader to keep composition separate from IO.
 */
export async function getSeriesWithWritings(
  slug: string,
  getWritingsInSeries: (seriesSlug: string) => Promise<WritingData[]>
): Promise<SeriesWithWritings> {
  const definition = await getSeries(slug);
  const writings = await getWritingsInSeries(slug);

  return {
    ...definition,
    writings,
    totalParts: writings.length,
  };
}

/**
 * Gets all series with their writings loaded.
 */
export async function getAllSeriesWithWritings(
  getWritingsInSeries: (seriesSlug: string) => Promise<WritingData[]>
): Promise<SeriesWithWritings[]> {
  const slugs = await getSeriesSlugs();
  const seriesList = await Promise.all(
    slugs.map((slug) => getSeriesWithWritings(slug, getWritingsInSeries))
  );

  // Sort by most recent writing or startedAt
  return seriesList.sort((a, b) => {
    const aDate =
      a.writings[0]?.published ??
      (a.startedAt ? new Date(a.startedAt) : new Date(0));
    const bDate =
      b.writings[0]?.published ??
      (b.startedAt ? new Date(b.startedAt) : new Date(0));
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}
