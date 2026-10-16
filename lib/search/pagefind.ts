import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { site } from '@/lib/site/identity';

import { type SearchableItem, UNDATED } from './types';

export interface PagefindRecord {
  url: string;
  content: string;
  language: string;
  meta: Record<string, string>;
  filters: Record<string, string[]>;
  sort?: Record<string, string>;
}

/** Only the generator operations used by the build; injectable for offline IO checks. */
interface PagefindBackend {
  createIndex(): Promise<{
    errors: string[];
    index?: {
      addCustomRecord(record: PagefindRecord): Promise<{ errors: string[] }>;
      getFiles(): Promise<{
        errors: string[];
        files: Array<{ path: string; content: Uint8Array }>;
      }>;
    } | null;
  }>;
  close(): Promise<unknown>;
}

/** Maps a search item to the shape Pagefind's `addCustomRecord` takes. */
export function toPagefindRecord(item: SearchableItem): PagefindRecord {
  return {
    url: item.path,
    language: site.language,
    content: [item.title, item.description, item.content]
      .filter(Boolean)
      .join('\n\n'),
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
  outputPath: string,
  loadBackend: () => Promise<PagefindBackend> = () => import('pagefind')
): Promise<void> {
  const pagefind = await loadBackend();
  try {
    const { index, errors: createErrors } = await pagefind.createIndex();
    if (!index) {
      throw new Error(
        `Pagefind could not create an index: ${createErrors.join('; ')}`
      );
    }
    for (const item of items) {
      const { errors } = await index.addCustomRecord(toPagefindRecord(item));
      if (errors.length > 0) {
        throw new Error(`Pagefind rejected ${item.path}: ${errors.join('; ')}`);
      }
    }
    const { errors, files } = await index.getFiles();
    if (errors.length > 0) {
      throw new Error(
        `Pagefind could not write ${outputPath}: ${errors.join('; ')}`
      );
    }
    // The pinned worker can acknowledge writeFiles before asset writes finish.
    // Export complete bytes and await Node's writes before closing that worker.
    await rm(outputPath, { recursive: true, force: true });
    await mkdir(outputPath, { recursive: true });
    await Promise.all(
      files.map(async (file) => {
        if (file.content.byteLength === 0)
          throw new Error(`Pagefind returned an empty asset: ${file.path}`);
        const destination = join(outputPath, file.path);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, file.content);
      })
    );
  } finally {
    await pagefind.close();
  }
}
