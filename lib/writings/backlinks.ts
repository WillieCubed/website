import { join } from 'node:path';
import { cache } from 'react';

import { markdownFiles } from '@/lib/content/files';
import { readFileSync } from '@/lib/content/runtime-files';

import { loadWritingMetadata } from './load';

const writingsDirectory = join(process.cwd(), 'content/writings');

export interface Backlink {
  slug: string;
  title: string;
  excerpt: string;
  published: Date;
}

const linkPatterns = [
  [
    /\[([^\]]*)\]\(\/writings\/([a-z0-9-]+)\/?(?:#[^)]*)?(?:\s+"[^"]*")?\)/gi,
    2,
  ],
  [/href=["']\/writings\/([a-z0-9-]+)\/?(?:#[^"']*)?["']/gi, 1],
] as const;

// React shares the index within a render. Node publishing tools see later edits.
const extractInternalLinks = cache(() => {
  const links = new Map<string, Set<string>>();
  for (const file of markdownFiles(writingsDirectory)) {
    const sourceSlug = file.replace(/\.mdx?$/, '');
    const content = readFileSync(join(writingsDirectory, file), 'utf-8');
    for (const [pattern, group] of linkPatterns) {
      for (const match of content.matchAll(pattern)) {
        const targetSlug = match[group];
        if (targetSlug === sourceSlug) continue;
        const sources = links.get(targetSlug) ?? new Set<string>();
        sources.add(sourceSlug);
        links.set(targetSlug, sources);
      }
    }
  }
  return links;
});

/** Public writings that link to this post, newest first and without duplicates. */
export async function getBacklinksForPost(slug: string): Promise<Backlink[]> {
  const sources = extractInternalLinks().get(slug) ?? [];
  const backlinks = await Promise.all(
    Array.from(sources, async (sourceSlug) => {
      try {
        const writing = await loadWritingMetadata(sourceSlug);
        if (writing.draft) return null;
        return {
          slug: writing.slug,
          title: writing.title,
          excerpt: writing.description,
          published: writing.published,
        };
      } catch {
        // Missing, reserved, or malformed sources do not break the target page.
        return null;
      }
    })
  );
  return backlinks
    .filter((backlink): backlink is Backlink => backlink !== null)
    .sort((a, b) => b.published.getTime() - a.published.getTime());
}
