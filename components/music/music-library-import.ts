import type { MusicConnection, MusicImportProgress } from '@/lib/music/types';

import {
  MusicAdminRequestError,
  musicAdminRequest,
} from './music-admin-request';

/** The refresh needs to report playlists that still need attention. */
export interface MusicImportOutcome {
  failed: number;
}

export interface MusicLibraryImportServices {
  startImport(): Promise<MusicImportOutcome>;
  readProgress(): Promise<MusicImportProgress | null | undefined>;
  now(): number;
}

const importServices: MusicLibraryImportServices = {
  startImport: () =>
    musicAdminRequest<MusicImportOutcome>('/import', { method: 'POST' }),
  readProgress: async () =>
    (await musicAdminRequest<MusicConnection>('/connection')).import,
  now: () => Date.now(),
};

/** Recover a lost response only when this refresh's saved progress is complete. */
export async function importMusicLibrary(
  services: MusicLibraryImportServices = importServices
): Promise<MusicImportOutcome> {
  const startedAt = services.now();
  try {
    return await services.startImport();
  } catch (error) {
    // An HTTP rejection is a known failure, not an import whose response was lost.
    if (error instanceof MusicAdminRequestError) throw error;

    const progress = await services.readProgress();
    const completed = completedImportSince(progress, startedAt);
    if (!completed) throw error;
    return completed;
  }
}

function completedImportSince(
  progress: MusicImportProgress | null | undefined,
  startedAt: number
): MusicImportProgress | null {
  if (!progress) return null;
  if (progress.running) return null;

  const finishedAt = Date.parse(progress.updatedAt);
  if (!Number.isFinite(finishedAt)) return null;
  if (finishedAt < startedAt) return null;

  const accountedFor = progress.done + progress.failed;
  if (accountedFor < progress.total) return null;
  return progress;
}
