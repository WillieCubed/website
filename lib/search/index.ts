import { getWritingSlugs, loadWriting } from '@/lib/writings';

import type { SearchableItem } from './types';

/**
 * Strips MDX/Markdown syntax from content to get plain text for search indexing.
 */
function stripMdxSyntax(content: string): string {
  return (
    content
      // Remove import statements
      .replace(/^import\s+.*$/gm, '')
      // Remove export statements
      .replace(/^export\s+.*$/gm, '')
      // Remove JSX components (self-closing and with children)
      .replace(/<[A-Z][a-zA-Z]*[^>]*\/>/g, '')
      .replace(/<[A-Z][a-zA-Z]*[^>]*>[\s\S]*?<\/[A-Z][a-zA-Z]*>/g, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Remove markdown links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove markdown images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`[^`]+`/g, '')
      // Remove headings markers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic markers
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      // Remove blockquotes
      .replace(/^>\s+/gm, '')
      // Remove horizontal rules
      .replace(/^---+$/gm, '')
      // Remove list markers
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Normalize whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * Generates a search index from all published writings.
 *
 * The prebuild script calls this outside Next.js, so it reads through
 * `loadWriting` rather than the cached `getWriting`.
 */
export async function generateSearchIndex(): Promise<SearchableItem[]> {
  const slugs = await getWritingSlugs();
  const loaded = await Promise.all(slugs.map((slug) => loadWriting(slug)));

  const items: SearchableItem[] = loaded
    .filter(({ writing }) => !writing.draft)
    .map(({ writing, content }) => {
      const plainContent = stripMdxSyntax(content);

      return {
        slug: writing.slug,
        title: writing.title,
        description: writing.description,
        content: plainContent,
        tags: writing.tags,
        published: new Date(writing.published).toISOString(),
        type: 'writing' as const,
      };
    });

  // Sort by date (newest first) for time-ordered results
  return items.sort(
    (a, b) => new Date(b.published).getTime() - new Date(a.published).getTime()
  );
}

export type { SearchableItem, SearchResult } from './types';
