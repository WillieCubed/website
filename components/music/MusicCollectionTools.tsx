import type { ReactNode } from 'react';

import Icon from '@/components/icons/Icon';
import Button from '@/components/site/Button';
import Popover from '@/components/site/Popover';

interface PickerProps {
  visible: boolean;
  title: string | undefined;
  count: number;
  loading: boolean;
  children: ReactNode;
}
export function CollectionPicker({
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
      triggerClassName="music-collection-picker"
      panelClassName="music-collection-menu"
      width={320}
      trigger={
        <>
          <span>{title ?? 'All playlists'}</span>
          <span className="music-small">{count}</span>
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
export function ReorderToggle({
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
      className="music-reorder-toggle"
      aria-label={reordering ? 'Finish reordering' : 'Reorder playlists'}
      aria-pressed={reordering}
      disabled={loading || (!reordering && (count < 2 || !filterAll))}
      onClick={onToggle}
    >
      {reordering ? 'Done' : 'Reorder'}
    </Button>
  );
}
