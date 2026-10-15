import { publicCatalog } from './schema';
import type { MusicCatalog } from './types';

interface NamedPlaylist {
  id: string;
  title: string;
}

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
  if (added.length > 0) changes.push(`Added: ${added.map(name).join(', ')}`);
  if (removed.length > 0)
    changes.push(`Removed: ${removed.map(name).join(', ')}`);
  if (before.lead !== after.lead)
    changes.push(
      `Featured playlist: ${after.lead !== null ? name(after.lead) : 'None'}`
    );
  if (before.order.join('\0') !== after.order.join('\0'))
    changes.push(
      `Playlist order: ${after.order.length > 0 ? after.order.map(name).join(' → ') : 'Empty'}`
    );

  const changedSeries = seriesChanges(before, after, name);
  changes.push(...changedSeries.descriptions);

  const noteIds = new Set([
    ...Object.keys(before.notes),
    ...Object.keys(after.notes),
  ]);
  const editedNotes = [...noteIds].filter(
    (id) => before.notes[id] !== after.notes[id]
  );
  if (editedNotes.length > 0)
    changes.push(`Updated notes: ${editedNotes.map(name).join(', ')}`);

  let subject = publicationSubject(
    before,
    after,
    added,
    removed,
    editedNotes,
    changedSeries.changedTitles,
    name
  );

  const prefix = 'feat(music): ';
  const max = 80 - prefix.length;
  if (subject.length > max) subject = `${subject.slice(0, max - 1).trimEnd()}…`;
  const title = `${prefix}${subject}`;
  const body = [
    changes.length > 0
      ? changes.join('\n')
      : 'The approved collection is unchanged.',
    `Music-Revision: ${revisionId}`,
  ].join('\n\n');
  return { title, message: `${title}\n\n${body}` };
}

type PlaylistName = (id: string) => string;
interface SeriesChangeSummary {
  descriptions: string[];
  changedTitles: string[];
}
function seriesChanges(
  before: MusicCatalog,
  after: MusicCatalog,
  name: PlaylistName
): SeriesChangeSummary {
  const descriptions: string[] = [];
  const changedTitles = new Set<string>();
  const beforeSeries = new Map(
    before.series.map((series) => [series.id, series])
  );
  const afterSeries = new Map(
    after.series.map((series) => [series.id, series])
  );
  for (const series of after.series) {
    const old = beforeSeries.get(series.id);
    if (old === undefined) {
      descriptions.push(`Added series: ${clean(series.title)}`);
      changedTitles.add(series.title);
    } else if (old.title !== series.title) {
      descriptions.push(
        `Renamed series: ${clean(old.title)} → ${clean(series.title)}`
      );
      changedTitles.add(series.title);
    }
    if (
      old !== undefined &&
      old.playlistIds.join('\0') !== series.playlistIds.join('\0')
    ) {
      descriptions.push(
        `Series order (${clean(series.title)}): ${series.playlistIds.map(name).join(' → ')}`
      );
      changedTitles.add(series.title);
    }
  }
  for (const series of before.series)
    if (!afterSeries.has(series.id)) {
      descriptions.push(`Removed series: ${clean(series.title)}`);
      changedTitles.add(series.title);
    }

  return { descriptions, changedTitles: [...changedTitles] };
}
function publicationSubject(
  before: MusicCatalog,
  after: MusicCatalog,
  added: string[],
  removed: string[],
  editedNotes: string[],
  changedSeriesTitles: string[],
  name: PlaylistName
) {
  return (
    membershipSubject(before, after, added, removed, name) ??
    organizationSubject(before, after, changedSeriesTitles, name) ??
    notesSubject(editedNotes, name)
  );
}
function membershipSubject(
  before: MusicCatalog,
  after: MusicCatalog,
  added: string[],
  removed: string[],
  name: PlaylistName
) {
  if (before.selected.length === 0 && after.selected.length > 0)
    return `Publish ${after.selected.length} ${after.selected.length === 1 ? 'playlist' : 'playlists'} to the music gallery`;
  if (added.length === 1) return `Add ${name(added[0])} to the music gallery`;
  if (added.length > 0)
    return `Add ${added.length} playlists to the music gallery`;
  if (removed.length === 1)
    return `Remove ${name(removed[0])} from the music gallery`;
  if (removed.length > 0)
    return `Remove ${removed.length} playlists from the music gallery`;

  return null;
}
function organizationSubject(
  before: MusicCatalog,
  after: MusicCatalog,
  changedSeriesTitles: string[],
  name: PlaylistName
) {
  if (before.lead !== after.lead)
    return after.lead !== null
      ? `Feature ${name(after.lead)}`
      : 'Remove the featured playlist';
  if (before.order.join('\0') !== after.order.join('\0'))
    return 'Reorder the music collection';
  if (changedSeriesTitles.length > 0)
    return `Update the ${clean(changedSeriesTitles[0])} series`;

  return null;
}
function notesSubject(editedNotes: string[], name: PlaylistName) {
  if (editedNotes.length === 1)
    return `Update notes for ${name(editedNotes[0])}`;
  if (editedNotes.length > 0)
    return `Update notes for ${editedNotes.length} playlists`;
  return 'Republish the music collection';
}
