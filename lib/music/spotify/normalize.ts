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
  const durationMs = trackDurationMs(item.duration_ms);
  const local = envelope.is_local === true || item.is_local === true;
  const kind = local ? 'local' : item.type === 'episode' ? 'episode' : 'track';
  return {
    title: String(item.name),
    artist: trackArtist(item, kind),
    duration: formatDuration(durationMs),
    durationMs,
    kind,
    unavailable: item.is_playable === false,
    url: trackUrl(item.id, kind, local),
  };
}

function trackDurationMs(value: unknown) {
  return typeof value === 'number' && value >= 0 ? value : null;
}
function formatDuration(durationMs: number | null) {
  if (durationMs === null) return '—';
  const seconds = Math.floor(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
function trackArtist(item: Record<string, unknown>, kind: MusicTrack['kind']) {
  if (kind === 'episode')
    return String(record(item.show).name ?? item.publisher ?? 'Podcast');
  if (!Array.isArray(item.artists)) return '';
  return item.artists
    .map((artist: unknown) => String(record(artist).name ?? ''))
    .join(', ');
}
function trackUrl(id: unknown, kind: MusicTrack['kind'], local: boolean) {
  return !local && /^[A-Za-z0-9]{22}$/.test(String(id ?? ''))
    ? `https://open.spotify.com/${kind}/${id}`
    : null;
}
function playlistImage(images: unknown) {
  if (!Array.isArray(images)) return null;
  return (
    (
      images.find((image: unknown) => {
        try {
          const url = new URL(String(record(image).url));
          return (
            url.protocol === 'https:' &&
            [
              'i.scdn.co',
              'mosaic.scdn.co',
              'image-cdn-ak.spotifycdn.com',
              'image-cdn-fa.spotifycdn.com',
            ].includes(url.hostname)
          );
        } catch {
          return false;
        }
      }) as { url: string } | undefined
    )?.url ?? null
  );
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
  const image = playlistImage(item.images);
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
