import type { MusicCatalog } from '@/lib/music/types';

export const recoveryKey = 'willie-music-recovery-v1';
export interface MusicDraftRecovery {
  catalog: MusicCatalog;
  base: string | null;
}
export function recoveredMusicDraft(
  saved: MusicCatalog | undefined
): MusicDraftRecovery | null {
  try {
    const local = JSON.parse(localStorage.getItem(recoveryKey) ?? 'null');
    return local?.catalog &&
      JSON.stringify(local.catalog) !== JSON.stringify(saved)
      ? (local as MusicDraftRecovery)
      : null;
  } catch {
    return null;
  }
}

export function rememberMusicDraft(
  catalog: MusicCatalog,
  base: string | null
): boolean {
  try {
    localStorage.setItem(recoveryKey, JSON.stringify({ base, catalog }));
    return true;
  } catch {
    return false;
  }
}

export function clearMusicDraftRecovery(): void {
  try {
    localStorage.removeItem(recoveryKey);
  } catch {
    /* Optional browser recovery cannot invalidate an intact server revision. */
  }
}
