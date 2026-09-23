/**
 * Collections API - Generic system for loading and managing collections.
 *
 * Collections are stored as MDX files in content/[type]/ directories.
 * For example, series are in content/series/, reading lists in content/reading-lists/, etc.
 */
import matter from 'gray-matter';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// =============================================================================
// Series-specific helpers (for backward compatibility and convenience)
// =============================================================================

import { getInitiative, initiativeExists } from '../initiatives';
import type { WritingData } from '../writings/types';
import type {
  Collection,
  CollectionDefinition,
  RawCollectionFrontmatter,
} from './types';

export type { Collection, CollectionDefinition, RawCollectionFrontmatter };

const HIDDEN_ITEM_PREFIX = '_';
const CONTENT_DIR = join(process.cwd(), 'content');

/**
 * Configuration for a collection type.
 */
interface CollectionTypeConfig<TMeta extends Record<string, unknown>> {
  /** Directory name under content/ (e.g., 'series', 'reading-lists') */
  directory: string;
  /** Function to extract metadata from frontmatter */
  parseMetadata: (frontmatter: RawCollectionFrontmatter) => TMeta;
  /** Function to derive createdAt from frontmatter */
  getCreatedAt: (frontmatter: RawCollectionFrontmatter) => string;
}

/**
 * Gets the directory path for a collection type.
 */
function getCollectionDirectory(type: string): string {
  return join(CONTENT_DIR, type);
}

/**
 * Gets all slugs for a collection type.
 */
export async function getCollectionSlugs(type: string): Promise<string[]> {
  const directory = getCollectionDirectory(type);

  if (!existsSync(directory)) {
    return [];
  }

  const slugs = readdirSync(directory)
    .filter((file) => file.endsWith('.mdx') || file.endsWith('.md'))
    .filter((file) => !file.startsWith(HIDDEN_ITEM_PREFIX))
    .map((file) => file.replace(/\.mdx?$/, ''));

  return slugs;
}

/**
 * Reads a collection file and returns the raw content and frontmatter.
 */
function readCollectionFile(
  type: string,
  slug: string
): { source: Buffer; filePath: string } {
  const directory = getCollectionDirectory(type);
  const mdxPath = join(directory, `${slug}.mdx`);

  if (existsSync(mdxPath)) {
    return { source: readFileSync(mdxPath), filePath: mdxPath };
  }

  const mdPath = join(directory, `${slug}.md`);
  if (existsSync(mdPath)) {
    return { source: readFileSync(mdPath), filePath: mdPath };
  }

  throw new Error(`Collection "${slug}" of type "${type}" cannot be found.`);
}

/**
 * Gets a collection definition (without items) by type and slug.
 */
export async function getCollectionDefinition<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
>(
  type: string,
  slug: string,
  config: CollectionTypeConfig<TMeta>
): Promise<CollectionDefinition<TMeta>> {
  const { source } = readCollectionFile(type, slug);
  const fileContent = source.toString();

  const { data, content } = matter(fileContent);
  const frontmatter = data as RawCollectionFrontmatter;

  return {
    slug,
    type,
    name: (frontmatter.name as string) || slug,
    description: (frontmatter.description as string) || '',
    coverImage: frontmatter.coverImage as string | undefined,
    createdAt: config.getCreatedAt(frontmatter),
    updatedAt: undefined, // Could be derived from git or frontmatter
    content,
    metadata: config.parseMetadata(frontmatter),
  };
}

/**
 * Gets all collection definitions of a type (without items).
 */
export async function getAllCollectionDefinitions<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
>(
  type: string,
  config: CollectionTypeConfig<TMeta>
): Promise<CollectionDefinition<TMeta>[]> {
  const slugs = await getCollectionSlugs(type);
  const definitions = await Promise.all(
    slugs.map((slug) => getCollectionDefinition(type, slug, config))
  );
  return definitions;
}

/** Metadata shape for series collections */
export interface SeriesMetadata {
  complete: boolean;
  startedAt?: string;
  [key: string]: unknown; // Index signature for Record<string, unknown> compatibility
}

/** Series collection configuration */
const seriesConfig: CollectionTypeConfig<SeriesMetadata> = {
  directory: 'series',
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
  // A writing's series slug can name an initiative instead of a file in
  // content/series/, so a series of writings about Superbloom lands on
  // /initiatives/superbloom rather than a collections page that does not
  // exist.
  const hasFile = (await getCollectionSlugs('series')).includes(slug);
  if (!hasFile && (await initiativeExists(slug))) {
    const initiative = await getInitiative(slug);
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
    href: `/writings?series=${definition.slug}`,
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
 * Note: This requires the writings module, so we import it dynamically to avoid
 * circular dependencies.
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
      a.writings[0]?.published ||
      (a.startedAt ? new Date(a.startedAt) : new Date(0));
    const bDate =
      b.writings[0]?.published ||
      (b.startedAt ? new Date(b.startedAt) : new Date(0));
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}
