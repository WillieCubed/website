import type { ReactNode } from 'react';

import Icon from '@/components/icons/Icon';
import SpotifyIcon from '@/components/icons/SpotifyIcon';
import SiteLink from '@/components/link/SiteLink';
import Button from '@/components/site/Button';

import type { MusicLibraryFilter } from '@/lib/music/presentation';
import { spotifyProfileUrl } from '@/lib/site/identity';

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
    <section className="mp-collection" aria-labelledby="mp-collection-title">
      {header}
      {filters}
      {children}
      {empty}
      <p className="mp-sample-note">
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
      className="mp-public-placeholder"
      aria-labelledby="mp-public-placeholder-title"
    >
      <span className="mp-public-placeholder-icon" aria-hidden="true">
        <Icon name="music" size={32} />
      </span>
      <h2 id="mp-public-placeholder-title">
        {loadError
          ? 'Playlists are unavailable right now.'
          : 'No playlists to show right now.'}
      </h2>
      <p>
        {loadError ??
          'My playlists normally appear here. You can still explore them on Spotify.'}
      </p>
      <div className="mp-public-placeholder-actions">
        {loadError && (
          <form action="/music" method="get">
            <Button variant="tonal">Try again</Button>
          </form>
        )}
        <SiteLink
          className="mp-button mp-public-placeholder-link"
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
        className="mp-library-filters"
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
            key={value}
            aria-pressed={libraryFilter === value}
            disabled={loading}
            onClick={() => setLibraryFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mp-visually-hidden">
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
  return (
    <div className="mp-empty">
      <Icon name="music" size={32} />
      <EmptyCollectionMessage
        editing={editing}
        libraryFilter={libraryFilter}
        hasLibrary={hasLibrary}
      />
      {(editing ? hasLibrary : hasSelection) && (
        <button className="mp-button" onClick={onBrowse}>
          Browse all playlists
        </button>
      )}
    </div>
  );
}

interface EmptyCollectionMessageProps {
  editing: boolean;
  libraryFilter: MusicLibraryFilter;
  hasLibrary: boolean;
}

function EmptyCollectionMessage({
  editing,
  libraryFilter,
  hasLibrary,
}: EmptyCollectionMessageProps) {
  return (
    <>
      <h3>
        {editing && libraryFilter === 'unselected'
          ? 'Every playlist is included.'
          : editing && libraryFilter === 'selected'
            ? 'No playlists included yet'
            : 'This series is still empty'}
      </h3>
      <p>
        {editing && !hasLibrary
          ? 'Connect Spotify to bring playlists into the studio.'
          : editing && libraryFilter !== 'all'
            ? 'Choose All to see the rest of the library.'
            : editing
              ? 'Open a playlist from All playlists to add it to this series.'
              : 'Explore All playlists for more of Willie’s music.'}
      </p>
    </>
  );
}
