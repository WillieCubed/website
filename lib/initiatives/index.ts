import { cache } from 'react';

import { showDrafts } from '@/lib/content/visibility';

import {
  listInitiativeSlugs,
  loadAllInitiatives,
  loadInitiative,
  parsePartSlug,
} from './load';
import type { Initiative, Part } from './schema';

export * from './schema';

/**
 * Every initiative slug a visitor can open: hidden ones excluded, and
 * drafts excluded in production.
 */
export async function getInitiativeSlugs(): Promise<string[]> {
  const now = new Date();
  return listInitiativeSlugs().filter(
    (slug) => showDrafts || !loadInitiative(slug, now, showDrafts).draft
  );
}

/**
 * Find a visible initiative, returning null for missing and unpublished slugs.
 */
export async function findPublishedInitiative(
  slug: string
): Promise<Initiative | null> {
  if (!listInitiativeSlugs().includes(slug)) return null;
  const initiative = loadInitiative(slug, new Date(), showDrafts);
  return initiative.draft && !showDrafts ? null : initiative;
}

/**
 * One initiative with its parts, statuses resolved against the clock.
 * Throws for a missing or hidden slug, and for a draft in production, so
 * every page, image, and series link that loads an initiative by slug
 * treats an unpublished one as missing.
 */
export async function getInitiative(slug: string): Promise<Initiative> {
  const initiative = await findPublishedInitiative(slug);
  if (!initiative) throw new Error(`No published initiative "${slug}"`);
  return initiative;
}

/**
 * All initiatives, drafts excluded in production, most recent start first.
 */
export const getInitiatives = cache(async (): Promise<Initiative[]> => {
  return loadAllInitiatives({ includeDrafts: showDrafts }).sort(
    (a, b) => (b.starts?.getTime() ?? 0) - (a.starts?.getTime() ?? 0)
  );
});

/** Feature ordering leaves the shared initiative snapshot unchanged. */
export function featuredInitiatives(all: Initiative[]): Initiative[] {
  return all
    .filter((item) => item.feature)
    .sort((a, b) => (b.feature?.weight ?? 0) - (a.feature?.weight ?? 0));
}

/** One part of an initiative, by its `part-N` slug. */
export async function getPart(
  initiativeSlug: string,
  slug: string
): Promise<{ initiative: Initiative; part: Part } | null> {
  const number = parsePartSlug(slug);
  if (number === null) return null;
  const initiative = await getInitiative(initiativeSlug).catch(() => null);
  if (!initiative) return null;
  const part = initiative.parts.find((item) => item.number === number);
  return part ? { initiative, part } : null;
}

export { currentPart } from './load';

/** Children of an initiative (initiatives whose parent is this slug). */
export async function getChildInitiatives(slug: string): Promise<Initiative[]> {
  const all = await getInitiatives();
  return all.filter((item) => item.parent === slug);
}
