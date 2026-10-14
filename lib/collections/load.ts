/**
 * Collections API - Generic system for loading and managing collections.
 *
 * Load authored MDX collections, keeping each collection type separate.
 */
import matter from 'gray-matter';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { markdownFiles, readMarkdownFile } from '@/lib/content/files';

import type { CollectionDefinition, RawCollectionFrontmatter } from './types';

export type { CollectionDefinition, RawCollectionFrontmatter };

const CONTENT_DIR = join(process.cwd(), 'content');

/**
 * Configuration for a collection type.
 */
export interface CollectionTypeConfig<TMeta extends Record<string, unknown>> {
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

  return markdownFiles(directory).map((file) => file.replace(/\.mdx?$/, ''));
}

/**
 * Reads a collection file and returns the raw content and frontmatter.
 */
function readCollectionFile(
  type: string,
  slug: string
): { source: Buffer; filePath: string } {
  return readMarkdownFile(
    getCollectionDirectory(type),
    slug,
    `Collection "${slug}" of type "${type}" cannot be found.`,
    'exists'
  );
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
    updatedAt: undefined,
    content,
    metadata: config.parseMetadata(frontmatter),
  };
}
