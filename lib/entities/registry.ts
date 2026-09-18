import { cacheLife } from 'next/cache';

import { getInitiatives } from '@/lib/initiatives';
import { getAllProjects } from '@/lib/projects';
import { site } from '@/lib/site';
import { getAllWritings } from '@/lib/writings';

import type { EntityCard } from './types';

export type { EntityCard };

/**
 * Pages that are not generated from content but still deserve a card.
 * Keep the descriptions in sync with each page's metadata.
 */
const STATIC_PAGES: EntityCard[] = [
  {
    href: '/',
    kind: 'page',
    title: site.name,
    description: site.shortDescription,
  },
  {
    href: '/initiatives',
    kind: 'page',
    title: 'Initiatives',
    description:
      'The campaigns, series, and projects Willie is running right now.',
  },
  {
    href: '/writings',
    kind: 'page',
    title: 'Writings',
    description: 'Articles, notes, and replies from Willie.',
  },
  {
    href: '/projects',
    kind: 'page',
    title: 'Projects',
    description: 'Apps and other things Willie has built.',
  },
  {
    href: '/about',
    kind: 'page',
    title: 'About',
    description: 'Who Willie is, what he has done, and where he is going.',
    cover: { src: '/assets/headshot.jpg', alt: 'Willie Chalmers III' },
  },
  {
    href: '/contact',
    kind: 'page',
    title: 'Contact',
    description: "How to get in touch with Willie. It's pretty simple.",
  },
  {
    href: '/now',
    kind: 'page',
    title: 'Now',
    description: "What Willie is working on and what's coming up next.",
  },
  {
    href: '/media',
    kind: 'page',
    title: 'Media and art',
    description: 'The Willie Diaries and other creative work.',
  },
];

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function range(starts: Date, ends: Date) {
  const short = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `${short.format(starts)} – ${short.format(ends)}`;
}

/**
 * Every entity on the site, keyed by path, for hover cards and social
 * images. Cached for an hour like the loaders it reads from.
 */
export async function getEntityRegistry(): Promise<EntityCard[]> {
  'use cache';
  cacheLife('hours');

  const [writings, projects, initiatives] = await Promise.all([
    getAllWritings(false),
    getAllProjects(),
    getInitiatives(),
  ]);

  const cards: EntityCard[] = [...STATIC_PAGES];

  for (const writing of writings) {
    cards.push({
      href: `/writings/${writing.slug}`,
      kind: 'writing',
      title: writing.title,
      description: writing.description,
      cover: writing.featuredImage
        ? { src: writing.featuredImage, alt: writing.featuredImageAlt ?? '' }
        : undefined,
      meta: `${dateFormat.format(new Date(writing.published))} · ${writing.readingTime} min read`,
    });
  }

  for (const project of projects) {
    cards.push({
      href: `/projects/${project.codename}`,
      kind: 'project',
      title: project.title,
      description: project.tagline || project.description,
      cover: project.thumbnail
        ? { src: project.thumbnail, alt: project.title }
        : undefined,
      meta: project.clientAttribution || undefined,
    });
  }

  for (const initiative of initiatives) {
    const brand = initiative.brand?.startsWith('#')
      ? initiative.brand
      : undefined;
    cards.push({
      href: initiative.href,
      kind: 'initiative',
      title: initiative.title,
      description: initiative.tagline,
      cover: initiative.cover,
      brand,
      meta:
        initiative.starts && initiative.ends
          ? range(initiative.starts, initiative.ends)
          : undefined,
    });
    for (const part of initiative.parts) {
      cards.push({
        href: `${initiative.href}/${part.slug}`,
        kind: 'part',
        title: part.title,
        description: part.tagline ?? part.description ?? initiative.tagline,
        cover: part.cover ?? initiative.cover,
        brand,
        meta: `${initiative.partLabel} ${part.number} of ${initiative.parts.length} · ${range(part.starts, part.ends)}`,
      });
    }
  }

  return cards;
}

export { entityKey } from './key';
