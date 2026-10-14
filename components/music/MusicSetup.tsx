'use client';

import { useEffect, useRef, useState } from 'react';
import { type ComponentType } from 'react';

import Icon from '@/components/icons/Icon';
import SpotifyIcon from '@/components/icons/SpotifyIcon';
import { usePalette } from '@/components/search/palette/PaletteProvider';
import PaletteTrigger from '@/components/search/palette/PaletteTrigger';

import {
  type Catalog,
  type PlaylistView,
  listeningTime,
} from '@/lib/music/presentation';

import MusicCover from './MusicCover';
import MusicSelectionControl from './MusicSelectionControl';
import './music-setup.css';

const steps = ['Connect', 'Choose', 'Preview'];

export default function MusicSetup({
  catalog,
  playlists,
  Cover = MusicCover,
  mode = 'public',
  connected = false,
  onConnect,
  onCancel,
  onComplete,
}: {
  catalog: Catalog;
  playlists: PlaylistView[];
  Cover?: ComponentType<{ playlist: PlaylistView }>;
  mode?: string;
  connected?: boolean;
  onConnect?: () => Promise<void>;
  onCancel: () => void;
  onComplete: (catalog: Catalog) => void;
}) {
  const [step, setStep] = useState(connected ? 1 : 0);
  const [selected, setSelected] = useState<string[]>(
    mode === 'admin'
      ? catalog.selected.filter((id) =>
          playlists.some((p) => p.id === id && p.eligible)
        )
      : []
  );
  const [lead, setLead] = useState<string | null>(
    mode === 'admin' ? catalog.lead : null
  );
  const { close: closePalette, registerCommands } = usePalette();
  const title = useRef<HTMLHeadingElement>(null);
  const collection = catalog.order.flatMap((id) => {
    const playlist = playlists.find((item) => item.id === id);
    return playlist && selected.includes(id) ? [playlist] : [];
  });
  const featured = collection.find((playlist) => playlist.id === lead);

  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [step]);

  function toggle(id: string) {
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
    );
    setLead((current) => (current === id ? null : current));
  }

  useEffect(() => {
    if (step !== 1) return;
    return registerCommands(
      playlists
        .filter((playlist) => playlist.eligible)
        .map((playlist) => ({
          id: `music:select:${playlist.id}`,
          title: playlist.title,
          detail: selected.includes(playlist.id)
            ? 'Remove from your collection'
            : 'Add to your collection',
          group: 'Playlists' as const,
          keywords: ['playlist', 'music', 'select'],
          kind: 'music' as const,
          run: async () => {
            await closePalette({ animate: false, restoreFocus: false });
            toggle(playlist.id);
            const row = [
              ...document.querySelectorAll<HTMLElement>('.ms-playlist'),
            ].find((item) => item.dataset.playlist === playlist.id);
            row
              ?.querySelector<HTMLInputElement>('input')
              ?.focus({ preventScroll: true });
            row?.scrollIntoView({
              behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
                ? 'instant'
                : 'smooth',
              block: 'center',
            });
          },
        }))
    );
  }, [step, playlists, selected, registerCommands, closePalette]);

  return (
    <>
      {mode === 'prototype' && (
        <div className="mp-prototype-bar ms-prototype-notice">
          <span>Local prototype · Spotify connection is simulated.</span>
        </div>
      )}
      <div className="ms-shell">
        <header className="ms-header">
          <span className="ms-wordmark">Music</span>
          <div className="ms-header-actions">
            <PaletteTrigger size="compact" />
            <button
              className="ms-button ms-tonal ms-exit"
              onClick={onCancel}
              aria-label="Exit setup"
            >
              <span>Exit setup</span>
              <Icon name="x" />
            </button>
          </div>
        </header>
        <ol className="ms-steps" aria-label="Setup progress">
          {steps.map((label, index) => (
            <li
              key={label}
              aria-current={index === step ? 'step' : undefined}
              data-complete={index < step || undefined}
            >
              <span className="ms-step-number" aria-hidden="true">
                {index < step ? <Icon name="check" /> : index + 1}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
        <main id="main" className="ms-main">
          {step === 0 ? (
            <section className="ms-connect" aria-labelledby="ms-title">
              <div className="ms-connect-copy">
                <h1 id="ms-title" ref={title} tabIndex={-1}>
                  Your playlists.
                  <br />
                  Your call.
                </h1>
                <p className="ms-intro">
                  Bring your Spotify playlists here. Choose what belongs, give
                  your favorites room, and keep every track in its place.
                </p>
                <button
                  className="ms-button ms-primary ms-connect-button"
                  onClick={() =>
                    mode === 'prototype' ? setStep(1) : void onConnect?.()
                  }
                >
                  <SpotifyIcon />
                  Connect Spotify
                  <Icon name="arrow-right" />
                </button>
                <p className="ms-permission">
                  Read your playlists. Never change them.
                  <br />
                  You choose what goes in the gallery.
                </p>
              </div>
              <div className="ms-cover-arrangement" aria-hidden="true">
                <div className="ms-art ms-art-back">
                  {playlists[4] ? (
                    <Cover playlist={playlists[4]} />
                  ) : (
                    <SpotifyIcon />
                  )}
                </div>
                <div className="ms-art ms-art-middle">
                  {playlists[1] ? (
                    <Cover playlist={playlists[1]} />
                  ) : (
                    <Icon name="music" />
                  )}
                </div>
                <div className="ms-art ms-art-front">
                  {playlists[0] ? (
                    <Cover playlist={playlists[0]} />
                  ) : (
                    <Icon name="music" />
                  )}
                </div>
              </div>
              <div className="ms-connect-details">
                <div>
                  <Icon name="check" />
                  <p>
                    Include a few favorites.
                    <span>The rest can stay on Spotify.</span>
                  </p>
                </div>
                <div>
                  <Icon name="music" />
                  <p>
                    Keep the sequence.
                    <span>Track order stays exactly as you made it.</span>
                  </p>
                </div>
                <div>
                  <Icon name="file" />
                  <p>
                    Make room for a series.
                    <span>Group and order playlists during curation.</span>
                  </p>
                </div>
              </div>
            </section>
          ) : step === 1 ? (
            <section aria-labelledby="ms-title">
              <div className="ms-selection-heading">
                <div>
                  <h1 id="ms-title" ref={title} tabIndex={-1}>
                    What belongs here?
                  </h1>
                  <p className="ms-intro">
                    Choose the playlists you want in your collection. You can
                    change this later.
                  </p>
                </div>
              </div>
              <div className="ms-source">
                <SpotifyIcon />
                <span>
                  {mode === 'prototype'
                    ? 'Sample Spotify library'
                    : 'Your public Spotify playlists'}
                </span>
                <span>{playlists.length} playlists</span>
              </div>
              <fieldset className="ms-playlists">
                <legend className="sr-only">Choose playlists</legend>
                {playlists.map((playlist) => (
                  <label
                    className="ms-playlist"
                    key={playlist.id}
                    data-playlist={playlist.id}
                    data-selected={selected.includes(playlist.id) || undefined}
                  >
                    <div className="ms-playlist-art">
                      <Cover playlist={playlist} />
                    </div>
                    <span className="ms-playlist-copy">
                      <span className="ms-playlist-title">
                        {playlist.title}
                      </span>
                      <span className="ms-playlist-meta">
                        {playlist.trackCount} tracks ·{' '}
                        {listeningTime(playlist.tracks)}
                      </span>
                    </span>
                    <MusicSelectionControl
                      aria-label={`Select ${playlist.title}`}
                      checked={selected.includes(playlist.id)}
                      onChange={() => toggle(playlist.id)}
                    />
                  </label>
                ))}
              </fieldset>
              {playlists.length === 0 && (
                <p className="ms-empty">
                  No owned public playlists are available. Make a playlist
                  public on Spotify, then refresh your library.
                </p>
              )}
            </section>
          ) : (
            <section aria-labelledby="ms-title">
              <h1 id="ms-title" ref={title} tabIndex={-1}>
                Give it your shape.
              </h1>
              <p className="ms-intro">
                Put one playlist up front, or give them equal space. Order,
                notes, and series come next.
              </p>
              <div className="ms-preview-layout">
                <div
                  className="ms-gallery-preview"
                  aria-label="Collection preview"
                >
                  <h2>Music</h2>
                  {featured ? (
                    <div className="ms-feature-preview">
                      <Cover playlist={featured} />
                      <div>
                        <h3>{featured.title}</h3>
                        <p>
                          {featured.trackCount} tracks ·{' '}
                          {listeningTime(featured.tracks)}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  <div className="ms-preview-grid">
                    {collection
                      .filter((playlist) => playlist.id !== lead)
                      .map((playlist) => (
                        <div key={playlist.id}>
                          <Cover playlist={playlist} />
                          <h3>{playlist.title}</h3>
                        </div>
                      ))}
                  </div>
                  <p className="ms-preview-caption">
                    Your collection · {collection.length}{' '}
                    {collection.length === 1 ? 'playlist' : 'playlists'}
                  </p>
                </div>
                <fieldset className="ms-feature-options">
                  <legend>Featured playlist</legend>
                  <p>Choose one playlist, or give them equal space.</p>
                  <label
                    className="ms-feature-option ms-feature-none"
                    data-selected={!lead || undefined}
                  >
                    <span className="ms-feature-option-copy">
                      No featured playlist
                    </span>
                    <MusicSelectionControl
                      type="radio"
                      name="setup-feature"
                      aria-label="No featured playlist"
                      indicator="equal"
                      checked={!lead}
                      onChange={() => setLead(null)}
                    />
                  </label>
                  <div className="ms-feature-playlists">
                    {collection.map((playlist) => (
                      <label
                        className="ms-feature-option"
                        key={playlist.id}
                        data-selected={lead === playlist.id || undefined}
                      >
                        <Cover playlist={playlist} />
                        <span className="ms-feature-option-copy">
                          {playlist.title}
                        </span>
                        <MusicSelectionControl
                          type="radio"
                          name="setup-feature"
                          aria-label={`Feature ${playlist.title}`}
                          indicator="feature"
                          checked={lead === playlist.id}
                          onChange={() => setLead(playlist.id)}
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </section>
          )}
        </main>
        {step > 0 && (
          <div className="ms-actions" role="group" aria-label="Setup actions">
            <button
              className="ms-button ms-tonal"
              onClick={() => setStep(step - 1)}
            >
              <Icon name="arrow-left" />
              Back
            </button>
            <p role="status">
              {step === 1
                ? `${selected.length} selected`
                : 'Nothing goes live from setup.'}
            </p>
            <button
              className="ms-button ms-primary"
              disabled={!selected.length}
              onClick={() =>
                step === 1
                  ? setStep(2)
                  : onComplete({
                      ...catalog,
                      selected: collection.map((playlist) => playlist.id),
                      lead,
                    })
              }
            >
              {step === 1 ? 'Preview collection' : 'Continue to curation'}
              <Icon name="arrow-right" />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
