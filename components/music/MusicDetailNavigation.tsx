import type { RefObject } from 'react';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';

import { isPlainClick } from '@/lib/dom/click';
import type { MusicSeries } from '@/lib/music/types';

import PlaylistToolbarTitle from './PlaylistToolbarTitle';

interface Props {
  closeHref: string;
  index: number;
  ids: string[];
  series: MusicSeries | undefined;
  title: string;
  playlistId: string;
  dialog: RefObject<HTMLDialogElement | null>;
  onOpen: (id: string) => void;
  onClose: () => void;
}
export default function MusicDetailNavigation({
  index,
  ids,
  series,
  title,
  playlistId,
  dialog,
  onOpen,
  onClose,
  closeHref,
}: Props) {
  return (
    <div className="mp-detail-bar scroller">
      <SiteLink
        href={closeHref}
        preview={false}
        className="site-control mp-icon-button mp-detail-close"
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          onClose();
        }}
        aria-label="Close playlist"
      >
        <Icon name="x" size={24} />
      </SiteLink>
      <PlaylistToolbarTitle
        key={`${playlistId}:${title}`}
        title={title}
        dialogRef={dialog}
      />
      <div className="mp-detail-actions">
        {!series && (
          <div className="mp-detail-position">
            <span>
              {index + 1} of {ids.length}
            </span>
          </div>
        )}
        <div
          className="mp-detail-pagination"
          role="group"
          aria-label="Playlist navigation"
        >
          <button
            className="site-control mp-icon-button mp-icon-button--tonal"
            data-control-size="small"
            disabled={index <= 0}
            onClick={() => onOpen(ids[index - 1])}
            aria-label="Previous playlist"
          >
            <span className="site-control__surface">
              <Icon name="arrow-left" size={24} />
            </span>
          </button>
          <button
            className="site-control mp-icon-button mp-icon-button--tonal"
            data-control-size="small"
            disabled={index < 0 || index >= ids.length - 1}
            onClick={() => onOpen(ids[index + 1])}
            aria-label="Next playlist"
          >
            <span className="site-control__surface">
              <Icon name="arrow-right" size={24} />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
