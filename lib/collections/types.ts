/**
 * Generic collection type system.
 *
 * Collections are flexible containers for grouping related content.
 * The type system is fully generic - no hardcoded collection types.
 */

/**
 * Base collection interface with generic item and metadata types.
 *
 * @template TItem - The type of items in the collection
 * @template TMeta - Additional type-specific metadata
 *
 * @example
 * // For a series of writings:
 * type SeriesCollection = Collection<WritingData, { complete: boolean }>
 *
 * @example
 * // For a reading list:
 * type ReadingList = Collection<{ url: string; title: string }, { curator: string }>
 */
export interface Collection<
  TItem = unknown,
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Unique identifier derived from filename */
  slug: string;

  /** Collection type (e.g., 'series', 'reading-list', 'playlist') */
  type: string;

  /** Display name */
  name: string;

  /** Brief description */
  description: string;

  /** Optional cover image URL */
  coverImage?: string;

  /** When the collection was created */
  createdAt: string;

  /** When the collection was last updated */
  updatedAt?: string;

  /** MDX content for the collection landing page */
  content: string;

  /** Items in the collection */
  items: TItem[];

  /** Type-specific metadata */
  metadata: TMeta;
}

/**
 * Collection definition as stored in MDX files (before items are loaded).
 * This is what we parse from the frontmatter.
 */
export interface CollectionDefinition<
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> {
  slug: string;
  type: string;
  name: string;
  description: string;
  coverImage?: string;
  createdAt: string;
  updatedAt?: string;
  content: string;
  metadata: TMeta;
}

/**
 * Raw frontmatter shape for collection MDX files.
 * Used internally during parsing.
 */
export interface RawCollectionFrontmatter {
  name?: string;
  description?: string;
  coverImage?: string;
  /** For series: when it was started */
  startedAt?: string;
  /** For series: whether complete */
  complete?: boolean;
  /** Any additional metadata fields */
  [key: string]: unknown;
}
