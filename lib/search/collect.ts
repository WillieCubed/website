import { STATIC_PAGES } from '@/lib/entities/pages';
import type { EntityCard } from '@/lib/entities/types';
import { detailHref } from '@/lib/entities/ventures';
import { type Entry, entries } from '@/lib/home/ventures';
import {
  type Initiative,
  type Part,
  loadAllInitiatives,
} from '@/lib/initiatives';
import { type WritingData, getWritingSlugs, loadWriting } from '@/lib/writings';

import { type SearchableItem, UNDATED } from './types';

/**
 * Strips MDX/Markdown syntax from content to get plain text for search indexing.
 */
function stripMdxSyntax(content: string): string {
  return (
    content
      // Remove code first, so `Promise<Response>` in a code span is never read
      // as a component tag
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      // Remove import statements
      .replace(/^import\s+.*$/gm, '')
      // Remove export statements
      .replace(/^export\s+.*$/gm, '')
      // Remove JSX component tags but keep the text between them, so a
      // component's children stay searchable. An attribute value may hold a
      // `>` inside quotes or braces.
      .replace(
        /<\/?[A-Z][a-zA-Z]*(?:\s(?:"[^"]*"|'[^']*'|\{[^}]*\}|[^>"'{])*)?\/?>/g,
        ''
      )
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Remove markdown links but keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove markdown images
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
      // Remove headings markers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic markers
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      // Underscore emphasis only at word edges, so snake_case_names survive
      .replace(/(^|\W)__([^_]+)__(?=\W|$)/g, '$1$2')
      .replace(/(^|\W)_([^_]+)_(?=\W|$)/g, '$1$2')
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

export function writingToItem(
  writing: WritingData,
  content: string
): SearchableItem {
  return {
    slug: writing.slug,
    path: `/writings/${writing.slug}`,
    title: writing.title,
    description: writing.description,
    content: stripMdxSyntax(content),
    tags: writing.tags,
    published: new Date(writing.published).toISOString(),
    type: 'writing',
  };
}

function initiativeToItem(initiative: Initiative): SearchableItem {
  return {
    slug: `initiatives/${initiative.slug}`,
    path: initiative.href,
    title: initiative.title,
    description: initiative.description,
    content: [initiative.tagline, stripMdxSyntax(initiative.content)].join(
      '\n\n'
    ),
    tags: [initiative.kind],
    published: initiative.starts?.toISOString() ?? UNDATED,
    type: 'initiative',
  };
}

function partToItem(initiative: Initiative, part: Part): SearchableItem {
  return {
    slug: `initiatives/${initiative.slug}/${part.slug}`,
    path: `${initiative.href}/${part.slug}`,
    title: `${initiative.partLabel} ${part.number}: ${part.title}`,
    description: part.description || part.tagline || initiative.description,
    content: [
      part.tagline,
      part.places.map((place) => place.name).join(', '),
      stripMdxSyntax(part.content),
    ]
      .filter(Boolean)
      .join('\n\n'),
    tags: [initiative.title],
    published: part.starts.toISOString(),
    type: 'initiative',
  };
}

/** The initiative and each published part; nothing for a draft. */
export function initiativeToItems(initiative: Initiative): SearchableItem[] {
  if (initiative.draft) return [];
  return [
    initiativeToItem(initiative),
    ...initiative.parts
      .filter((part) => !part.draft)
      .map((part) => partToItem(initiative, part)),
  ];
}

export function pageToItem(page: EntityCard): SearchableItem {
  const key = page.href === '/' ? 'home' : page.href.replace(/^\//, '');
  return {
    slug: `pages/${key}`,
    path: page.href,
    title: page.title,
    description: page.description,
    // Description is the page's whole text; as content it doubled the excerpt.
    content: '',
    tags: [],
    published: UNDATED,
    type: 'page',
  };
}

/**
 * A homepage venture or studio product. Its first paragraph is the excerpt,
 * and the rest of the detail view, list included, is the searchable text.
 */
export function entryToItem(entry: Entry): SearchableItem {
  const [lead = '', ...rest] = entry.detail.body;
  const list = (entry.detail.list ?? []).map(
    (item) => `${item.title}: ${item.text}`
  );
  return {
    slug: `ventures/${entry.id}`,
    path: detailHref(entry.id),
    title: entry.name,
    description: lead,
    content: [...rest, ...list].join('\n\n'),
    tags: entry.parent ? [entry.parent] : [],
    published: UNDATED,
    // A detail view opens over the homepage, so it is searched as a page.
    type: 'page',
  };
}

function byNewest(a: SearchableItem, b: SearchableItem): number {
  return new Date(b.published).getTime() - new Date(a.published).getTime();
}

/**
 * Everything the site's search covers: published writings, initiatives and
 * their parts, the static pages, and the homepage ventures and products that
 * are not hidden. Drafts are excluded here rather than trusted to the
 * loaders, because the prebuild script runs outside Next.js where the
 * loaders show drafts. It reads through the uncached loaders for the same
 * reason: `cacheLife()` throws under plain Node.
 */
export async function collectSearchDocuments(): Promise<SearchableItem[]> {
  const slugs = await getWritingSlugs();
  const loaded = await Promise.all(slugs.map((slug) => loadWriting(slug)));
  const writings = loaded
    .filter(({ writing }) => !writing.draft)
    .map(({ writing, content }) => writingToItem(writing, content));
  const initiatives = loadAllInitiatives().flatMap(initiativeToItems);
  const pages = STATIC_PAGES.map(pageToItem);
  const ventures = Object.values(entries).map(entryToItem);
  return [...writings, ...initiatives, ...pages, ...ventures].sort(byNewest);
}
