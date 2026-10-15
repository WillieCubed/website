'use client';
import type { ComponentType, RefObject } from 'react';

import Icon from '@/components/icons/Icon';

import {
  type Catalog,
  type MusicMode,
  type PlaylistView,
} from '@/lib/music/presentation';

import MusicCover from './MusicCover';
import { scrollDialogContent } from './music-dialog';

type Props = {
  open: boolean;
  reviewDialog: RefObject<HTMLDialogElement | null>;
  closeReview: () => void;
  onEditOrder: () => void;
  draft: Catalog;
  playlists: PlaylistView[];
  Cover?: ComponentType<{ playlist: PlaylistView }>;
  mode: MusicMode;
  canReview?: boolean;
  applyReview: () => Promise<void>;
};
export default function MusicReview({
  open,
  reviewDialog,
  closeReview,
  onEditOrder,
  draft,
  playlists,
  Cover = MusicCover,
  mode,
  canReview = true,
  applyReview,
}: Props) {
  if (!open) return null;
  return (
    <dialog
      ref={reviewDialog}
      className="mp-review"
      aria-labelledby="mp-review-title"
      onCancel={(event) => {
        event.preventDefault();
        closeReview();
      }}
      onKeyDown={(event) =>
        scrollDialogContent(event, reviewDialog.current, '.mp-review-body')
      }
    >
      <header className="mp-review-header scroller">
        <div>
          <h2 id="mp-review-title" tabIndex={-1}>
            Review the collection
          </h2>
          <p>Check the order and context before applying changes.</p>
        </div>
        <button
          className="mp-icon-button mp-icon-button--tonal"
          aria-label="Close review"
          onClick={closeReview}
        >
          <Icon name="x" size={24} />
        </button>
      </header>
      <div
        className="mp-review-body scroller"
        role="region"
        aria-label="Collection review"
        tabIndex={-1}
      >
        <dl className="mp-review-summary">
          <div>
            <dt>In gallery</dt>
            <dd>{draft.selected.length}</dd>
          </div>
          <div>
            <dt>Not included</dt>
            <dd>{playlists.length - draft.selected.length}</dd>
          </div>
          <div>
            <dt>Series</dt>
            <dd>{draft.series.length}</dd>
          </div>
        </dl>
        <section className="mp-review-order">
          <div className="mp-review-section-heading">
            <h3>Gallery order</h3>
            <button className="mp-text-button" onClick={onEditOrder}>
              Edit order
            </button>
          </div>
          <ol>
            {draft.order
              .filter((id) => draft.selected.includes(id))
              .map((id, index) => {
                const playlist = playlists.find((item) => item.id === id)!;
                return (
                  <li key={id}>
                    <span className="mp-review-number">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="mp-review-cover">
                      <Cover playlist={playlist} />
                    </span>
                    <div>
                      <span className="mp-review-playlist-title">
                        {playlist.title}
                      </span>
                      {id === draft.lead && (
                        <span className="mp-review-feature-label">
                          Featured in the public gallery
                        </span>
                      )}
                      {draft.notes[id] && (
                        <p className="mp-review-note">{draft.notes[id]}</p>
                      )}
                    </div>
                  </li>
                );
              })}
          </ol>
        </section>
        <aside className="mp-review-context">
          <section className="mp-review-feature">
            <h3>Featured playlist</h3>
            {draft.lead ? (
              <>
                <div className="mp-review-feature-cover">
                  <Cover
                    playlist={playlists.find((item) => item.id === draft.lead)!}
                  />
                </div>
                <p>{playlists.find((item) => item.id === draft.lead)?.title}</p>
              </>
            ) : (
              <p>No featured playlist.</p>
            )}
          </section>
          {draft.series.map((item) => (
            <section key={item.id} className="mp-review-series">
              <h3>{item.title}</h3>
              {item.playlistIds.some((id) => draft.selected.includes(id)) ? (
                <ol>
                  {item.playlistIds
                    .filter((id) => draft.selected.includes(id))
                    .map((id) => (
                      <li key={id}>
                        {
                          playlists.find((playlist) => playlist.id === id)
                            ?.title
                        }
                      </li>
                    ))}
                </ol>
              ) : (
                <p>No selected playlists.</p>
              )}
            </section>
          ))}
        </aside>
      </div>
      <footer className="mp-review-actions scroller">
        <p>
          {mode === 'prototype'
            ? 'This action stays in this browser.'
            : 'Publish this saved collection to willie.page.'}
        </p>
        <button className="mp-button mp-tonal" onClick={closeReview}>
          Back to editing
        </button>
        <button
          className="mp-button mp-primary"
          disabled={mode !== 'prototype' && !canReview}
          onClick={applyReview}
        >
          {mode === 'prototype' ? 'Apply to prototype' : 'Publish collection'}
          <Icon name="check" />
        </button>
      </footer>
    </dialog>
  );
}
