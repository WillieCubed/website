import type { MusicPlaylist, MusicTrack } from '../types';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function normalizeTrack(value: unknown): MusicTrack {
  const envelope = record(value),
    item = record(envelope.item ?? envelope.track);
  if (!item.name)
    return {
      title: 'Unavailable item',
      artist: 'Its place in the sequence is preserved.',
      duration: '—',
      durationMs: null,
      kind: 'unavailable',
      unavailable: true,
      url: null,
    };
  const durationMs =
    typeof item.duration_ms === 'number' && item.duration_ms >= 0
      ? item.duration_ms
      : null;
  const seconds = durationMs === null ? null : Math.floor(durationMs / 1000);
  const local = envelope.is_local === true || item.is_local === true;
  const kind = local ? 'local' : item.type === 'episode' ? 'episode' : 'track';
  return {
    title: String(item.name),
    artist:
      kind === 'episode'
        ? String(record(item.show).name ?? item.publisher ?? 'Podcast')
        : Array.isArray(item.artists)
          ? item.artists
              .map((a: unknown) => String(record(a).name ?? ''))
              .join(', ')
          : '',
    duration:
      seconds === null
        ? '—'
        : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
    durationMs,
    kind,
    unavailable: item.is_playable === false,
    url:
      !local && /^[A-Za-z0-9]{22}$/.test(String(item.id ?? ''))
        ? `https://open.spotify.com/${kind}/${item.id}`
        : null,
  };
}
export function normalizePlaylist(
  value: unknown,
  owner: string,
  tracks: MusicTrack[],
  now: string
): MusicPlaylist {
  const item = record(value);
  if (
    !/^[A-Za-z0-9]{22}$/.test(String(item.id ?? '')) ||
    typeof item.name !== 'string' ||
    typeof item.snapshot_id !== 'string'
  )
    throw new Error('Spotify returned an invalid playlist.');
  const image = Array.isArray(item.images)
    ? ((
        item.images.find((i: unknown) => {
          try {
            const u = new URL(String(record(i).url));
            return (
              u.protocol === 'https:' &&
              [
                'i.scdn.co',
                'mosaic.scdn.co',
                'image-cdn-ak.spotifycdn.com',
                'image-cdn-fa.spotifycdn.com',
              ].includes(u.hostname)
            );
          } catch {
            return false;
          }
        }) as { url: string } | undefined
      )?.url ?? null)
    : null;
  return {
    id: String(item.id),
    title: item.name,
    description: String(item.description ?? ''),
    image,
    url: `https://open.spotify.com/playlist/${item.id}`,
    ownerId: String(record(item.owner).id ?? ''),
    eligible: item.public === true && record(item.owner).id === owner,
    snapshot: item.snapshot_id,
    tracks,
    trackCount: Number(
      record(item.items).total ?? record(item.tracks).total ?? tracks.length
    ),
    checkedAt: now,
    error: null,
  };
}
