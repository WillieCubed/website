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
