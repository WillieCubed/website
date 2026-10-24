import type { ReactNode } from 'react';

import type { MusicSeries } from '@/lib/music/types';

interface Props {
  series: MusicSeries | undefined;
  editing: boolean;
  loading: boolean;
  loadError?: string;
  onRetry?: () => void;
  hasSeries: boolean;
  count: number;
  tools?: ReactNode;
}
export default function MusicCollectionHeader({
  series,
  editing,
  loading,
  loadError,
  onRetry,
  hasSeries,
  count,
  tools,
}: Props) {
  return (
    <header
      className={
        !editing && !series && !loadError
          ? 'sr-only'
          : 'music-collection-header'
      }
    >
      <h2
        id="music-collection-title"
        className={editing || !series ? 'sr-only' : undefined}
      >
        {series?.title ?? (editing ? 'Playlists' : 'Willie’s playlists')}
      </h2>
      <CollectionLoadStatus
        loading={loading}
        loadError={loadError}
        editing={editing}
        hasSeries={hasSeries}
        count={count}
        inSeries={Boolean(series)}
        onRetry={onRetry}
      />
      {tools}
    </header>
  );
}
interface LoadStatusProps extends Pick<
  Props,
  'loading' | 'loadError' | 'editing' | 'hasSeries' | 'count' | 'onRetry'
> {
  inSeries: boolean;
}
function CollectionLoadStatus({
  loading,
  loadError,
  editing,
  hasSeries,
  count,
  inSeries,
  onRetry,
}: LoadStatusProps) {
  return (
    <p
      className={`music-loading-status${editing && hasSeries ? ' sr-only' : ''}`}
      role="status"
    >
      {collectionStatusText(loading, loadError, editing, count, inSeries)}
      {loading && loadError && onRetry && (
        <button className="site-control music-text-button" onClick={onRetry}>
          Try again
        </button>
      )}
    </p>
  );
}
function collectionStatusText(
  loading: boolean,
  error: string | undefined,
  editing: boolean,
  count: number,
  inSeries: boolean
): string {
  if (loading)
    return (
      error || (editing ? 'Loading playlists…' : 'Loading Willie’s playlists…')
    );
  return `${count} ${count === 1 ? 'playlist' : 'playlists'}${inSeries ? ' · In sequence' : ''}`;
}
