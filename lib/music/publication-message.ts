import { publicCatalog } from './schema';
import type { MusicCatalog } from './types';

type NamedPlaylist = { id: string; title: string };

const clean = (value: string) =>
  value
    .replace(/[\p{Cc}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function musicPublicationMessage(
  previous: MusicCatalog,
  next: MusicCatalog,
  playlists: NamedPlaylist[],
  revisionId: string
) {
  const before = publicCatalog(previous);
  const after = publicCatalog(next);
  const names = new Map(
    playlists.map((playlist) => [playlist.id, clean(playlist.title)])
  );
  const name = (id: string) => names.get(id) || `Playlist ${id}`;
  const beforeIds = new Set(before.selected);
  const afterIds = new Set(after.selected);
  const added = after.selected.filter((id) => !beforeIds.has(id));
  const removed = before.selected.filter((id) => !afterIds.has(id));
  const changes: string[] = [];
  if (added.length) changes.push(`Added: ${added.map(name).join(', ')}`);
  if (removed.length) changes.push(`Removed: ${removed.map(name).join(', ')}`);
  if (before.lead !== after.lead)
    changes.push(
      `Featured playlist: ${after.lead ? name(after.lead) : 'None'}`
    );
  if (before.order.join('\0') !== after.order.join('\0'))
    changes.push(
      `Playlist order: ${after.order.map(name).join(' → ') || 'Empty'}`
    );

  const beforeSeries = new Map(
    before.series.map((series) => [series.id, series])
  );
  const afterSeries = new Map(
    after.series.map((series) => [series.id, series])
  );
  for (const series of after.series) {
    const old = beforeSeries.get(series.id);
    if (!old) changes.push(`Added series: ${clean(series.title)}`);
    else if (old.title !== series.title)
      changes.push(
        `Renamed series: ${clean(old.title)} → ${clean(series.title)}`
      );
    if (old && old.playlistIds.join('\0') !== series.playlistIds.join('\0'))
      changes.push(
        `Series order (${clean(series.title)}): ${series.playlistIds.map(name).join(' → ')}`
      );
  }
  for (const series of before.series)
    if (!afterSeries.has(series.id))
      changes.push(`Removed series: ${clean(series.title)}`);

  const noteIds = new Set([
    ...Object.keys(before.notes),
    ...Object.keys(after.notes),
  ]);
  const editedNotes = [...noteIds].filter(
    (id) => before.notes[id] !== after.notes[id]
  );
  if (editedNotes.length)
    changes.push(`Updated notes: ${editedNotes.map(name).join(', ')}`);

  let subject: string;
  if (!before.selected.length && after.selected.length)
    subject = `Publish ${after.selected.length} ${after.selected.length === 1 ? 'playlist' : 'playlists'} to the music gallery`;
  else if (added.length === 1)
    subject = `Add ${name(added[0])} to the music gallery`;
  else if (added.length)
    subject = `Add ${added.length} playlists to the music gallery`;
  else if (removed.length === 1)
    subject = `Remove ${name(removed[0])} from the music gallery`;
  else if (removed.length)
    subject = `Remove ${removed.length} playlists from the music gallery`;
  else if (before.lead !== after.lead)
    subject = after.lead
      ? `Feature ${name(after.lead)}`
      : 'Remove the featured playlist';
  else if (before.order.join('\0') !== after.order.join('\0'))
    subject = 'Reorder the music collection';
  else if (
    changes.some(
      (change) =>
        change.includes('series:') || change.startsWith('Series order')
    )
  )
    subject = `Update the ${clean(after.series[0]?.title || before.series[0]?.title || 'music')} series`;
  else if (editedNotes.length === 1)
    subject = `Update notes for ${name(editedNotes[0])}`;
  else if (editedNotes.length)
    subject = `Update notes for ${editedNotes.length} playlists`;
  else subject = 'Republish the music collection';

  const prefix = 'feat(music): ';
  const max = 80 - prefix.length;
  if (subject.length > max) subject = `${subject.slice(0, max - 1).trimEnd()}…`;
  const title = `${prefix}${subject}`;
  const body = [
    changes.length
      ? changes.join('\n')
      : 'The approved collection is unchanged.',
    `Music-Revision: ${revisionId}`,
  ].join('\n\n');
  return { title, message: `${title}\n\n${body}` };
}
