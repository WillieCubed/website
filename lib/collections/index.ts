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
 * Checks if a collection type directory exists.
 */
export function collectionTypeExists(type: string): boolean {
  const dir = getCollectionDirectory(type);
  return existsSync(dir);
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

/**
 * Gets all available collection types by checking which directories exist.
 */
export async function getAvailableCollectionTypes(): Promise<string[]> {
  const types: string[] = [];

  // Check for known collection type directories
  const knownTypes = ['series', 'reading-lists', 'playlists'];

  for (const type of knownTypes) {
    if (collectionTypeExists(type)) {
      types.push(type);
    }
  }

  return types;
}

/**
 * Gets the display name for a collection type.
 */
export function getCollectionTypeDisplayName(type: string): string {
  const displayNames: Record<string, string> = {
    series: 'Series',
    'reading-lists': 'Reading Lists',
    playlists: 'Playlists',
  };
  return displayNames[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

/**
 * Gets the description for a collection type.
 */
export function getCollectionTypeDescription(type: string): string {
  const descriptions: Record<string, string> = {
    series: 'Multi-part explorations of specific topics',
    'reading-lists': 'Curated collections of recommended reading',
    playlists: 'Themed collections of posts',
  };
  return descriptions[type] || `Collections of type ${type}`;
}

// =============================================================================
// Slug lookup - find collection type from slug
// =============================================================================

/**
 * Result of looking up a collection by slug.
 */
export interface CollectionLookupResult {
  type: string;
  slug: string;
}

/**
 * Finds which collection type a slug belongs to.
 * Searches all known collection types for the given slug.
 *
 * @returns The type and slug if found, null otherwise
 */
export async function findCollectionBySlug(
  slug: string
): Promise<CollectionLookupResult | null> {
  const types = await getAvailableCollectionTypes();

  for (const type of types) {
    const slugs = await getCollectionSlugs(type);
    if (slugs.includes(slug)) {
      return { type, slug };
    }
  }

  return null;
}

/**
 * Gets all collection slugs across all types.
 * Returns array of { type, slug } pairs.
 */
export async function getAllCollectionSlugs(): Promise<
  CollectionLookupResult[]
> {
  const types = await getAvailableCollectionTypes();
  const results: CollectionLookupResult[] = [];

  for (const type of types) {
    const slugs = await getCollectionSlugs(type);
    for (const slug of slugs) {
      results.push({ type, slug });
    }
  }

  return results;
}

// =============================================================================
// Validation - prevent duplicate slugs across collection types
// =============================================================================

/**
 * Result of validating collection slugs.
 */
export interface SlugValidationResult {
  valid: boolean;
  duplicates: Array<{
    slug: string;
    types: string[];
  }>;
}

/**
 * Validates that all collection slugs are unique across all types.
 * This should be called at build time to prevent URL conflicts.
 *
 * @throws Error if duplicate slugs are found (in production builds)
 * @returns Validation result with details about any duplicates
 */
export async function validateCollectionSlugs(): Promise<SlugValidationResult> {
  const allSlugs = await getAllCollectionSlugs();

  // Group by slug to find duplicates
  const slugToTypes = new Map<string, string[]>();
  for (const { slug, type } of allSlugs) {
    const types = slugToTypes.get(slug) || [];
    types.push(type);
    slugToTypes.set(slug, types);
  }

  // Find duplicates (slugs that appear in more than one type)
  const duplicates: Array<{ slug: string; types: string[] }> = [];
  for (const [slug, types] of slugToTypes) {
    if (types.length > 1) {
      duplicates.push({ slug, types });
    }
  }

  const valid = duplicates.length === 0;

  // In production, throw an error if duplicates found
  if (!valid && process.env.NODE_ENV === 'production') {
    const details = duplicates
      .map(({ slug, types }) => `  - "${slug}" exists in: ${types.join(', ')}`)
      .join('\n');
    throw new Error(
      `Duplicate collection slugs detected! Each collection must have a unique slug across all types.\n${details}`
    );
  }

  // In development, log a warning
  if (!valid) {
    console.warn(
      '⚠️  Duplicate collection slugs detected:',
      duplicates.map(({ slug, types }) => `"${slug}" (${types.join(', ')})`)
    );
  }

  return { valid, duplicates };
}
