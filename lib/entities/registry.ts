import { cache } from 'react';

import { hasImageDescription } from '@/lib/accessibility/alt-policy';
import { formatRange } from '@/lib/initiatives/dates';
import { type Initiative, getInitiatives } from '@/lib/initiatives/index';
import { type Project, getPublishedProjects } from '@/lib/projects';
import { formatDate } from '@/lib/site/dates';
import { isInternalHref } from '@/lib/site/urls';
import { type WritingData, getAllWritings } from '@/lib/writings/index';
import { groupByTag, tagPath } from '@/lib/writings/tags';

import { entityKey } from './key';
import { STATIC_PAGES } from './pages';
import { projectCards } from './projects';
import { tagCards } from './tags';
import type { EntityCard } from './types';
import { VENTURE_CARDS } from './ventures';

export type { EntityCard };

function writingCover(writing: WritingData) {
  if (!writing.featuredImage) return undefined;
  if (!hasImageDescription(writing.featuredImageAlt)) {
    throw new Error(
      `Writing "${writing.slug}" has a featured image without alt text.`
    );
  }
  return { src: writing.featuredImage, alt: writing.featuredImageAlt.trim() };
}

/**
 * Every entity on the site, keyed by path, for hover cards and social
 * images. Source reads are shared only within the current server render.
 */
const getEntitySnapshot = cache(() =>
  Promise.all([getAllWritings(false), getInitiatives(), getPublishedProjects()])
);

export async function getEntityRegistry(): Promise<EntityCard[]> {
  return entityCards(...(await getEntitySnapshot()));
}

/**
 * Drops in-site links whose destination is not published, such as a chip
 * pointing at a writing that is still a draft. The link comes back on its own
 * once the page ships, so content can name a page before it exists.
 */
export async function publishedLinks<T extends { href: string }>(
  links: T[]
): Promise<T[]> {
  if (!links.some((link) => isInternalHref(link.href))) return links;
  const known = await getPublishedPaths();
  return links.filter(
    (link) => !isInternalHref(link.href) || known.has(entityKey(link.href))
  );
}

const getPublishedPaths = cache(async (): Promise<Set<string>> => {
  return entityPaths(...(await getEntitySnapshot()));
});

/** Publication membership does not construct images, date labels, or cards. */
export function entityPaths(
  writings: WritingData[],
  initiatives: Initiative[],
  projects: Project[] = []
): Set<string> {
  return new Set([
    ...STATIC_PAGES.map((page) => entityKey(page.href)),
    ...VENTURE_CARDS.map((venture) => entityKey(venture.href)),
    ...projects
      .filter((project) => !project.draft && project.visibility !== 'hidden')
      .map((project) => entityKey(project.href)),
    ...writings.map((writing) => `/writings/${writing.slug}`),
    ...groupByTag(writings).map(({ tag }) => tagPath(tag)),
    ...initiatives.flatMap((initiative) => [
      initiative.href,
      ...initiative.parts.map((part) => `${initiative.href}/${part.slug}`),
    ]),
  ]);
}

function initiativeCards(initiative: Initiative): EntityCard[] {
  const brand = initiative.brand?.startsWith('#')
    ? initiative.brand
    : undefined;
  return [
    {
      href: initiative.href,
      kind: 'initiative',
      title: initiative.title,
      description: initiative.tagline,
      cover: initiative.cover,
      brand,
      meta:
        initiative.starts && initiative.ends
          ? formatRange(initiative.starts, initiative.ends)
          : undefined,
    },
    ...initiative.parts.map(
      (part): EntityCard => ({
        href: `${initiative.href}/${part.slug}`,
        kind: 'part',
        title: part.title,
        description: part.tagline ?? part.description ?? initiative.tagline,
        cover: part.cover ?? initiative.cover,
        brand,
        meta: `${initiative.title} · ${initiative.partLabel} ${part.number} of ${initiative.parts.length} · ${formatRange(part.starts, part.ends)}`,
      })
    ),
  ];
}

/**
 * The cards for the static pages and ventures plus the given writings, the
 * tags they carry, initiatives, and published projects. Kept apart from the
 * cached loader so it runs under plain Node.
 */
export function entityCards(
  writings: WritingData[],
  initiatives: Initiative[],
  projects: Project[] = []
): EntityCard[] {
  return [
    ...STATIC_PAGES,
    ...VENTURE_CARDS,
    ...projectCards(projects),
    ...writings.map(
      (writing): EntityCard => ({
        href: `/writings/${writing.slug}`,
        kind: 'writing',
        title: writing.title,
        description: writing.description,
        cover: writingCover(writing),
        meta: `${formatDate(new Date(writing.published))} · ${writing.readingTime} min read`,
      })
    ),
    ...tagCards(writings),
    ...initiatives.flatMap(initiativeCards),
  ];
}

export { entityKey };
