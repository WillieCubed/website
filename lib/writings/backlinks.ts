import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { getWriting, getWritingSlugs } from './index';

const HIDDEN_ITEM_PREFIX = '_';
const writingsDirectory = join(process.cwd(), 'content/writings');

export interface Backlink {
  slug: string;
  title: string;
  excerpt: string;
  published: Date;
}

interface LinkMap {
  [targetSlug: string]: string[]; // targetSlug -> [sourceSlug1, sourceSlug2, ...]
}

// Cache for build-time performance
let cachedLinkMap: LinkMap | null = null;

/**
 * Extract all internal links from a writing's content.
 * Looks for links matching /writings/[slug] pattern.
 */
function extractLinksFromContent(content: string): string[] {
  const slugs: string[] = [];

  // Match markdown links: [text](/writings/slug) or [text](/writings/slug/)
  const markdownLinkRegex =
    /\[([^\]]*)\]\(\/writings\/([a-z0-9-]+)\/?(?:#[^)]*)?(?:\s+"[^"]*")?\)/gi;
  let match;
  while ((match = markdownLinkRegex.exec(content)) !== null) {
    slugs.push(match[2]);
  }

  // Match JSX/HTML links: href="/writings/slug"
  const jsxLinkRegex = /href=["']\/writings\/([a-z0-9-]+)\/?(?:#[^"']*)?["']/gi;
  while ((match = jsxLinkRegex.exec(content)) !== null) {
    slugs.push(match[1]);
  }

  // Deduplicate
  return [...new Set(slugs)];
}

/**
 * Build a map of all internal links between writings.
 * Returns a map where keys are target slugs and values are arrays of source slugs.
 */
export async function extractInternalLinks(): Promise<LinkMap> {
  if (cachedLinkMap) {
    return cachedLinkMap;
  }

  const linkMap: LinkMap = {};
  const files = readdirSync(writingsDirectory)
    .filter((file) => file.endsWith('.mdx') || file.endsWith('.md'))
    .filter((file) => !file.startsWith(HIDDEN_ITEM_PREFIX));

  for (const file of files) {
    const sourceSlug = file.replace(/\.mdx?$/, '');
    const filePath = join(writingsDirectory, file);
    const content = readFileSync(filePath, 'utf-8');

    const linkedSlugs = extractLinksFromContent(content);

    for (const targetSlug of linkedSlugs) {
      // Don't count self-links
      if (targetSlug === sourceSlug) continue;

      if (!linkMap[targetSlug]) {
        linkMap[targetSlug] = [];
      }
      if (!linkMap[targetSlug].includes(sourceSlug)) {
        linkMap[targetSlug].push(sourceSlug);
      }
    }
  }

  cachedLinkMap = linkMap;
  return linkMap;
}

/**
 * Get all writings that link to the given post.
 */
export async function getBacklinksForPost(slug: string): Promise<Backlink[]> {
  const linkMap = await extractInternalLinks();
  const sourceSlugs = linkMap[slug] || [];

  if (sourceSlugs.length === 0) {
    return [];
  }

  // Get all valid slugs to filter out any broken links
  const validSlugs = await getWritingSlugs();

  const backlinks = await Promise.all(
    sourceSlugs
      .filter((sourceSlug) => validSlugs.includes(sourceSlug))
      .map(async (sourceSlug) => {
        try {
          const { writing } = await getWriting(sourceSlug);
          return {
            slug: writing.slug,
            title: writing.title,
            excerpt: writing.description,
            published: writing.published,
          };
        } catch {
          // Skip if writing can't be loaded
          return null;
        }
      })
  );

  // Filter out nulls and sort by date (newest first)
  return backlinks
    .filter((b): b is Backlink => b !== null)
    .sort(
      (a, b) =>
        new Date(b.published).getTime() - new Date(a.published).getTime()
    );
}

/**
 * Clear the cached link map (useful for development/hot reload).
 */
export function clearBacklinksCache(): void {
  cachedLinkMap = null;
}
