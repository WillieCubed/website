import type { ReactNode } from 'react';

import Icon from '@/components/icons/Icon';
import SpotifyIcon from '@/components/icons/SpotifyIcon';
import SiteLink from '@/components/link/SiteLink';
import Button from '@/components/site/Button';

import type { MusicLibraryFilter } from '@/lib/music/presentation';
import { spotifyProfileUrl } from '@/lib/site/identity';

import './styles/gallery.css';

interface Props {
  publicEmpty: boolean;
  header: ReactNode;
  loadError?: string;
  filters?: ReactNode;
  empty?: ReactNode;
  children: ReactNode;
}
export default function MusicGallery({
  publicEmpty,
  header,
  loadError,
  filters,
  empty,
  children,
}: Props) {
  if (publicEmpty) return <MusicPublicPlaceholder loadError={loadError} />;
  return (
    <section
      className="music-collection"
      aria-labelledby="music-collection-title"
    >
      {header}
      {filters}
      {children}
      {empty}
      <p className="music-sample-note">
        <SpotifyIcon /> Playlist artwork and track information from Spotify.
      </p>
    </section>
  );
}
interface MusicPublicPlaceholderProps {
  loadError?: string;
}

function MusicPublicPlaceholder({ loadError }: MusicPublicPlaceholderProps) {
  return (
    <section
      className="music-public-placeholder"
      aria-labelledby="music-public-placeholder-title"
    >
      <span className="music-public-placeholder-icon" aria-hidden="true">
        <Icon name="music" size={32} />
      </span>
      <h2 id="music-public-placeholder-title">
        {loadError
          ? 'Playlists are unavailable right now.'
          : 'No playlists to show right now.'}
      </h2>
      <p>
        {loadError ??
          'My playlists normally appear here. You can still explore them on Spotify.'}
      </p>
      <div className="music-public-placeholder-actions">
        {loadError && (
          <form action="/music" method="get">
            <Button variant="tonal">Try again</Button>
          </form>
        )}
        <SiteLink
          className="site-control music-button music-public-placeholder-link"
          href={spotifyProfileUrl}
          target="_blank"
        >
          <SpotifyIcon />
          Explore playlists
          <Icon name="external" />
        </SiteLink>
      </div>
    </section>
  );
}
interface LibraryFiltersProps {
  editing: boolean;
  libraryFilter: MusicLibraryFilter;
  setLibraryFilter: (value: MusicLibraryFilter) => void;
  loading: boolean;
}

export function MusicLibraryFilters({
  editing,
  libraryFilter,
  setLibraryFilter,
  loading,
}: LibraryFiltersProps) {
  if (!editing) return null;
  return (
    <>
      <div
        className="music-library-filters"
        inert={loading || undefined}
        role="group"
        aria-label="Library filter"
      >
        {(
          [
            ['all', 'All'],
            ['selected', 'In gallery'],
            ['unselected', 'Not included'],
          ] as const
        ).map(([value, label]) => (
          <button
            className="site-control"
            key={value}
            aria-pressed={libraryFilter === value}
            disabled={loading}
            onClick={() => setLibraryFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="sr-only">
        Include playlists in the public gallery. Open a playlist to add notes
        and series.
      </p>
    </>
  );
}

interface EmptyCollectionProps {
  loading: boolean;
  count: number;
  editing: boolean;
  libraryFilter: MusicLibraryFilter;
  hasLibrary: boolean;
  hasSelection: boolean;
  onBrowse: () => void;
}

export function MusicEmptyCollection({
  loading,
  count,
  editing,
  libraryFilter,
  hasLibrary,
  hasSelection,
  onBrowse,
}: EmptyCollectionProps) {
  if (loading || count > 0) return null;
  const copy = emptyCollectionCopy(editing, libraryFilter, hasLibrary);
  return (
    <div className="music-empty">
      <Icon name="music" size={32} />
      <h3>{copy.title}</h3>
      <p>{copy.description}</p>
      {(editing ? hasLibrary : hasSelection) && (
        <button className="site-control music-button" onClick={onBrowse}>
          Browse all playlists
        </button>
      )}
    </div>
  );
}

function emptyCollectionCopy(
  editing: boolean,
  filter: MusicLibraryFilter,
  hasLibrary: boolean
) {
  const title = editing
    ? {
        all: 'This series is still empty',
        selected: 'No playlists included yet',
        unselected: 'Every playlist is included.',
      }[filter]
    : 'This series is still empty';
  let description = 'Explore All playlists for more of Willie’s music.';
  if (editing)
    description = !hasLibrary
      ? 'Connect Spotify to bring playlists into the studio.'
      : filter === 'all'
        ? 'Open a playlist from All playlists to add it to this series.'
        : 'Choose All to see the rest of the library.';
  return { title, description };
}
