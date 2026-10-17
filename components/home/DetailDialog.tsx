'use client';

import { Body, Media } from '@/components/home/DetailContent.tsx';
import { brandStyle, useHome } from '@/components/home/HomeContext';
import { Icon } from '@/components/home/Icon';
import { useDetailDialog } from '@/components/home/useDetailDialog';
import SiteLink from '@/components/link/SiteLink';
import Modal from '@/components/site/Modal';

import { isPlainClick } from '@/lib/dom/click';
import { type Entry, entries } from '@/lib/home/ventures';

interface DetailDialogProps {
  initialId?: string;
  /** Lets the shell hand `openDetail` calls from tiles and rows here. */
  registerOpener: (
    open: (id: string, from: HTMLElement | null) => void
  ) => void;
  countdown: React.ReactNode;
}

interface DetailBodyProps {
  entry: Entry | null;
  onOpen: (id: string) => void;
}

function DetailBody({ entry, onOpen }: DetailBodyProps) {
  return (
    <div className="d-content scroller">
      <span className="d-kicker">{entry?.parent ?? ''}</span>
      <h2 className="d-title" id="d-title">
        {entry?.name}
      </h2>
      {entry && <Body detail={entry.detail} onOpen={onOpen} />}
    </div>
  );
}

interface DetailContentsProps {
  openId: string | null;
  mediaRef: React.RefObject<HTMLDivElement | null>;
  countdown: React.ReactNode;
  onOpen: (id: string) => void;
}

function DetailContents({
  openId,
  mediaRef,
  countdown,
  onOpen,
}: DetailContentsProps) {
  const entry = openId ? entries[openId] : null;
  const media = entry?.detail.media;
  return (
    <div className="d-inner" key={openId ?? 'empty'}>
      <div
        className={
          media?.kind === 'image' && media.framed ? 'd-media framed' : 'd-media'
        }
        ref={mediaRef}
      >
        {media && openId && (
          <Media id={openId} media={media} countdown={countdown} />
        )}
      </div>
      <DetailBody entry={entry} onOpen={onOpen} />
    </div>
  );
}

/**
 * The detail view. What it shows and the `?detail=<id>` search param mirror
 * each other, so the back gesture, the close button, and a shared link all
 * land in the same state.
 *
 * The visitor's own actions change the dialog first and the URL after: a
 * click opens it and then pushes an entry, and a close closes it and drops
 * the param at once. Any other change to the param, such as Back, Forward,
 * or a command run from the command palette, is answered by opening,
 * swapping, or closing to match. Either way the request lands in `wantRef`,
 * and `settle` morphs toward it one step at a time, so a request made
 * mid-morph waits for the morph instead of being lost.
 */
export function DetailDialog({
  registerOpener,
  countdown,
  initialId,
}: DetailDialogProps) {
  const {
    openId,
    dialogRef,
    mediaRef,
    requestOpen,
    requestClose,
    onNativeClose,
  } = useDetailDialog(registerOpener, initialId);
  const { brands } = useHome();
  const entry = openId ? entries[openId] : null;
  const style = brandStyle(brands, entry?.brand);

  return (
    <Modal
      ref={dialogRef}
      initiallyOpen={Boolean(openId)}
      className="detail scroller"
      aria-labelledby="d-title"
      data-brand={entry?.brand}
      data-branded={entry && style ? '' : undefined}
      style={style}
      onDismiss={requestClose}
      onForcedClose={onNativeClose}
    >
      <div className="d-bar">
        <SiteLink
          href="/"
          preview={false}
          className="d-close"
          aria-label="Close"
          onClick={(event) => {
            if (!isPlainClick(event)) return;
            event.preventDefault();
            requestClose();
          }}
        >
          <Icon name="close" />
        </SiteLink>
      </div>
      <DetailContents
        openId={openId}
        mediaRef={mediaRef}
        countdown={countdown}
        onOpen={requestOpen}
      />
    </Modal>
  );
}
