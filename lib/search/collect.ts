import { STATIC_PAGES } from '@/lib/entities/pages';
import { tagCards } from '@/lib/entities/tags';
import type { EntityCard } from '@/lib/entities/types';
import { detailHref } from '@/lib/entities/ventures';
import { type Entry, entries } from '@/lib/home/ventures';
import {
  type Initiative,
  type Part,
  loadAllInitiatives,
  partTitle,
} from '@/lib/initiatives';
import { getMediaMentions } from '@/lib/media';
import { type Project, loadAllProjects } from '@/lib/projects';
import { projectFacts } from '@/lib/projects/facts';
import { stripMdxSyntax } from '@/lib/text/strip-mdx';
import { type WritingData, getWritingSlugs, loadWriting } from '@/lib/writings';
import { writingText } from '@/lib/writings/content';

import { type SearchableItem, UNDATED } from './types';

export function writingToItem(
  writing: WritingData,
  content: string
): SearchableItem {
  return {
    slug: writing.slug,
    path: `/writings/${writing.slug}`,
    title: writing.title,
    description: writing.description,
    content: writingText(content, writing),
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
    title: partTitle(initiative, part),
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
    title: page.href === '/' ? 'Home' : page.title,
    description: page.description,
    // Most static pages have only their description. Media has source text
    // worth finding by publisher or headline without duplicating the excerpt.
    content:
      page.href === '/media'
        ? getMediaMentions({ includeDrafts: false })
            .map((mention) => `${mention.publication}: ${mention.title}`)
            .join('\n')
        : '',
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

export function projectToItem(project: Project): SearchableItem {
  return {
    slug: `projects/${project.slug}`,
    path: project.href,
    title: project.title,
    description: project.line ?? '',
    content: [
      projectFacts(project).join(' · '),
      project.visibility === 'public' ? stripMdxSyntax(project.content) : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    tags: project.roles,
    published:
      project.starts?.toISOString() ??
      project.updated?.toISOString() ??
      UNDATED,
    type: 'project',
  };
}

/**
 * Everything the site's search covers: published writings and their tags,
 * initiatives and their parts, the static pages, and the homepage ventures
 * and products that are not hidden, and published projects. A tag is searched as a page, since it
 * has one. Drafts are excluded here rather than trusted to the
 * loaders, because the prebuild script runs outside Next.js where the
 * loaders show drafts. It reads through the uncached loaders for the same
 * reason: `cacheLife()` throws under plain Node.
 */
export async function collectSearchDocuments(): Promise<SearchableItem[]> {
  const slugs = await getWritingSlugs();
  const loaded = await Promise.all(slugs.map((slug) => loadWriting(slug)));
  const published = loaded.filter(({ writing }) => !writing.draft);
  const writings = published.map(({ writing, content }) =>
    writingToItem(writing, content)
  );
  const tags = tagCards(published.map(({ writing }) => writing)).map(
    pageToItem
  );
  const initiatives = loadAllInitiatives().flatMap(initiativeToItems);
  const pages = STATIC_PAGES.map(pageToItem);
  const ventures = Object.values(entries).map(entryToItem);
  const projects = loadAllProjects({ includeDrafts: false }).map(projectToItem);
  return [
    ...writings,
    ...tags,
    ...initiatives,
    ...pages,
    ...ventures,
    ...projects,
  ].sort(byNewest);
}
