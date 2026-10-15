import type { MusicCatalog } from '@/lib/music/types';

/** Read at the moment a revision operation starts, including queued edits. */
export interface MusicDraftSnapshot {
  readonly revisionId: string | null;
  readonly savedCatalog: MusicCatalog;
  readonly inFlight: boolean;
  readonly pending: boolean;
  readonly blocked: boolean;
}

export function canRefreshMusic(draft: MusicDraftSnapshot): boolean {
  return !draft.inFlight && !draft.pending;
}

export function canRestoreMusic(draft: MusicDraftSnapshot): boolean {
  return canRefreshMusic(draft) && !draft.blocked;
}

export function canPublishMusic(
  draft: MusicDraftSnapshot,
  busy: boolean
): boolean {
  return Boolean(draft.revisionId) && canRestoreMusic(draft) && !busy;
}

export function isReviewedMusic(
  draft: MusicDraftSnapshot,
  reviewed: MusicCatalog
): boolean {
  return JSON.stringify(reviewed) === JSON.stringify(draft.savedCatalog);
}
