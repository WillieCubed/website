import type { Catalog } from '@/lib/music/presentation';

export const MUSIC_PROTOTYPE_STORAGE_KEY = 'willie-music-prototype-v1';

export interface StoredMusicCatalog {
  live: Catalog;
  draft: Catalog;
}

interface PrototypeCatalogStorage {
  getItem(key: string): string | null;
}

interface UncheckedStoredMusicCatalog {
  live: unknown;
  draft: unknown;
}

export function readPrototypeCatalog(
  storage: PrototypeCatalogStorage,
  validate?: (value: unknown) => value is Catalog
): StoredMusicCatalog | null {
  const saved = JSON.parse(
    storage.getItem(MUSIC_PROTOTYPE_STORAGE_KEY) ?? 'null'
  ) as UncheckedStoredMusicCatalog | null;
  if (saved && validate?.(saved.live) && validate(saved.draft))
    return { live: saved.live, draft: saved.draft };
  return null;
}
