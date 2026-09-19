import { rm } from 'node:fs/promises';

import { site } from '@/lib/site';

import { type SearchableItem, UNDATED } from './types';

export interface PagefindRecord {
  url: string;
  content: string;
  language: string;
  meta: Record<string, string>;
  filters: Record<string, string[]>;
  sort?: Record<string, string>;
}

/** Maps a search item to the shape Pagefind's `addCustomRecord` takes. */
export function toPagefindRecord(item: SearchableItem): PagefindRecord {
  return {
    url: item.path,
    language: site.language,
    content: [item.description, item.content].filter(Boolean).join('\n\n'),
    meta: {
      title: item.title,
      description: item.description,
      type: item.type,
    },
    filters: {
      type: [item.type],
      ...(item.tags.length > 0 ? { tag: item.tags } : {}),
    },
    ...(item.published === UNDATED ? {} : { sort: { date: item.published } }),
  };
}

/**
 * Builds the Pagefind index from search items and writes it to `outputPath`,
 * replacing whatever was there. Throws if Pagefind reports any error, so a
 * broken index fails the build instead of shipping.
 */
export async function buildPagefindIndex(
  items: SearchableItem[],
  outputPath: string
): Promise<void> {
  const pagefind = await import('pagefind');
  const { index, errors: createErrors } = await pagefind.createIndex();
  if (!index) {
    throw new Error(
      `Pagefind could not create an index: ${createErrors.join('; ')}`
    );
  }
  try {
    for (const item of items) {
      const { errors } = await index.addCustomRecord(toPagefindRecord(item));
      if (errors.length > 0) {
        throw new Error(`Pagefind rejected ${item.path}: ${errors.join('; ')}`);
      }
    }
    await rm(outputPath, { recursive: true, force: true });
    const { errors } = await index.writeFiles({ outputPath });
    if (errors.length > 0) {
      throw new Error(
        `Pagefind could not write ${outputPath}: ${errors.join('; ')}`
      );
    }
  } finally {
    await pagefind.close();
  }
}
