import type { MusicPlaylist } from './types';

/** Stable identities keep these references attached when playlist titles change. */
const ALIASES: Readonly<Record<string, readonly string[]>> = {
  '7qgLqpNN5w1KwOnhEVojqz': ['main character'],
  '1CrRioD0EmSlk5jyndh6Oz': ['roll credits'],
  '732snle3EiiBBSEYEyJzYv': ['get to the point'],
};

export function musicAliases(id: string): string[] {
  return [...(ALIASES[id] ?? [])];
}

export function offersCredits(id: string): boolean {
  return id === '1CrRioD0EmSlk5jyndh6Oz';
}

export interface MusicEnding {
  message: string;
  link?: { id: string; title: string };
}

const ENDINGS: Readonly<Record<string, string>> = {
  '77lPlu2pXmfajcliKDLvkd': 'End of the line. Next tour, next playlist.',
  '2DZbglDEBcZ3k2vLAlPG50': 'End of the line. Next tour, next playlist.',
  '5zwgMw3RstoxCp3L4KYSeU': 'The band can go home now.',
  '57nDYJN2bUO9pYFjFnWSSw': 'Quarter-life crisis: temporarily paused.',
  '5AgpIU7pNfvef8FL9kvbYa': 'The short version still needed an ending.',
  '1ljGr9GCajT2olaYy5EXNl': 'You knew at least one of those.',
};

/** Endings belong after a complete sequence, never after a partial response. */
export function playlistEnding(
  playlist: MusicPlaylist,
  available: readonly MusicPlaylist[]
): MusicEnding | null {
  const count = playlist.tracks.length;
  if (count < 50 || count !== playlist.trackCount) return null;
  if (playlist.id === '62XTb89yYS322P7LODBSmU' && count >= 300) {
    const shorter = available.find(
      (item) =>
        item.id === '5AgpIU7pNfvef8FL9kvbYa' &&
        item.eligible &&
        item.tracks.length > 0 &&
        item.tracks.length < count &&
        item.tracks.length === item.trackCount
    );
    if (shorter)
      return {
        message: 'There was a shorter version.',
        link: { id: shorter.id, title: shorter.title },
      };
  }
  return {
    message:
      ENDINGS[playlist.id] ??
      (count >= 300
        ? 'That was the extended cut of the extended cut.'
        : count >= 150
          ? 'That was the extended cut.'
          : 'You found the end. For now.'),
  };
}
