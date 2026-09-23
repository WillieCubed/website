import type { Metadata } from 'next';

import { pageMetadata, site } from '@/lib/site';

import { type Entry, entries } from './ventures';

/**
 * The entry a `?detail=` value names, or undefined when it names nothing the
 * homepage shows. The lookup checks own keys so a value such as `toString`
 * cannot reach the object prototype.
 */
export function detailEntry(id: string | undefined): Entry | undefined {
  return id && Object.hasOwn(entries, id) ? entries[id] : undefined;
}

/**
 * Metadata for the homepage with one detail view open, so a shared
 * `/?detail=<id>` link and its history entry carry the venture's name.
 *
 * The root layout's title template skips a page in its own segment, so the
 * site name is added here. The canonical stays `/` because the view is part
 * of the homepage, while og:url keeps the parameter so a link preview opens
 * the same view.
 */
export function detailMetadata(id: string | undefined): Metadata | null {
  const entry = detailEntry(id);
  if (!entry) return null;
  return {
    ...pageMetadata({
      title: entry.name,
      description: entry.detail.body[0],
      path: `/?detail=${entry.id}`,
    }),
    title: { absolute: `${entry.name} · ${site.name}` },
    alternates: { canonical: '/' },
  };
}
