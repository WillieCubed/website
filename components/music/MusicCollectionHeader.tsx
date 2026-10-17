import type { ReactNode } from 'react';

import Icon from '@/components/icons/Icon';
import Button from '@/components/site/Button';
import Popover from '@/components/site/Popover';

import type { MusicSeries } from '@/lib/music/types';

interface Props {
  series: MusicSeries | undefined;
  editing: boolean;
  loading: boolean;
  loadError?: string;
  onRetry?: () => void;
  hasSeries: boolean;
  count: number;
  reordering: boolean;
  filterAll: boolean;
  onToggleReordering: () => void;
  seriesNavigation: ReactNode;
}
export default function MusicCollectionHeader({
  series,
  editing,
  loading,
  loadError,
  onRetry,
  hasSeries,
  count,
  reordering,
  filterAll,
  onToggleReordering,
  seriesNavigation,
}: Props) {
  return (
    <header
      className={
        !editing && !series && !loadError
          ? 'mp-visually-hidden'
          : 'mp-collection-header'
      }
    >
      <CollectionTitle series={series} editing={editing} />
      <CollectionLoadStatus
        loading={loading}
        loadError={loadError}
        editing={editing}
        hasSeries={hasSeries}
        count={count}
        inSeries={Boolean(series)}
        onRetry={onRetry}
      />
      <CollectionPicker
        visible={editing && hasSeries}
        title={series?.title}
        count={count}
        loading={loading}
      >
        {seriesNavigation}
      </CollectionPicker>
      <ReorderToggle
        visible={editing}
        reordering={reordering}
        loading={loading}
        count={count}
        filterAll={filterAll}
        onToggle={onToggleReordering}
      />
    </header>
  );
}
interface CollectionTitleProps {
  series: MusicSeries | undefined;
  editing: boolean;
}

function CollectionTitle({ series, editing }: CollectionTitleProps) {
  return (
    <h2
      id="mp-collection-title"
      className={editing || !series ? 'mp-visually-hidden' : undefined}
    >
      {series?.title ?? (editing ? 'Playlists' : 'Willie’s playlists')}
    </h2>
  );
}
interface LoadStatusProps {
  loading: boolean;
  loadError?: string;
  editing: boolean;
  hasSeries: boolean;
  count: number;
  inSeries: boolean;
  onRetry?: () => void;
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
      className={`mp-loading-status${editing && hasSeries ? ' mp-visually-hidden' : ''}`}
      role="status"
    >
      {collectionStatusText(loading, loadError, editing, count, inSeries)}
      {loading && loadError && onRetry && (
        <button className="site-control mp-text-button" onClick={onRetry}>
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
interface PickerProps {
  visible: boolean;
  title: string | undefined;
  count: number;
  loading: boolean;
  children: ReactNode;
}
function CollectionPicker({
  visible,
  title,
  count,
  loading,
  children,
}: PickerProps) {
  if (!visible) return null;
  return (
    <Popover
      label="Choose playlist collection"
      disabled={loading}
      triggerClassName="mp-collection-picker"
      panelClassName="mp-collection-menu"
      width={320}
      trigger={
        <>
          <span>{title ?? 'All playlists'}</span>
          <span className="mp-small">{count}</span>
          <Icon name="chevron-down" size={16} />
        </>
      }
    >
      {children}
    </Popover>
  );
}
interface ReorderProps {
  visible: boolean;
  reordering: boolean;
  loading: boolean;
  count: number;
  filterAll: boolean;
  onToggle: () => void;
}
function ReorderToggle({
  visible,
  reordering,
  loading,
  count,
  filterAll,
  onToggle,
}: ReorderProps) {
  if (!visible) return null;
  return (
    <Button
      variant="quiet"
      className="mp-reorder-toggle"
      aria-label={reordering ? 'Finish reordering' : 'Reorder playlists'}
      aria-pressed={reordering}
      disabled={loading || (!reordering && (count < 2 || !filterAll))}
      onClick={onToggle}
    >
      {reordering ? 'Done' : 'Reorder'}
    </Button>
  );
}
