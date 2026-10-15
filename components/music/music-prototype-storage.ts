import type { Catalog } from '@/lib/music/presentation';

export const MUSIC_PROTOTYPE_STORAGE_KEY = 'willie-music-prototype-v1';

export interface StoredMusicCatalog {
  live: Catalog;
  draft: Catalog;
}

export function readPrototypeCatalog(
  storage: Pick<Storage, 'getItem'>,
  validate?: (value: unknown) => value is Catalog
): StoredMusicCatalog | null {
  const saved = JSON.parse(
    storage.getItem(MUSIC_PROTOTYPE_STORAGE_KEY) ?? 'null'
  ) as { live: unknown; draft: unknown } | null;
  if (saved && validate?.(saved.live) && validate(saved.draft))
    return { live: saved.live, draft: saved.draft };
  return null;
}
