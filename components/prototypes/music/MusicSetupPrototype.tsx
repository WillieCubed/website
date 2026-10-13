'use client';

import { useEffect, useRef, useState } from 'react';

import Icon from '@/components/icons/Icon';
import SpotifyIcon from '@/components/icons/SpotifyIcon';

import {
  type Catalog,
  listeningTime,
  playlists,
  sampleTracks,
} from '@/lib/prototypes/music';

import MusicSelectionControl from './MusicSelectionControl';
import SampleCover from './SampleCover';
import './music-setup.css';

const steps = ['Connect', 'Choose', 'Preview'];

export default function MusicSetupPrototype({
  catalog,
  onCancel,
  onComplete,
}: {
  catalog: Catalog;
  onCancel: () => void;
  onComplete: (catalog: Catalog) => void;
}) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [lead, setLead] = useState<string | null>(null);
  const [search, setSearch] = useState('');
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
    if (lead === id) setLead(null);
  }

  return (
    <>
      <div className="mp-prototype-bar ms-prototype-notice">
        <span>Local prototype · Spotify connection is simulated.</span>
      </div>
      <div className="ms-shell">
        <header className="ms-header">
          <span className="ms-wordmark">Music</span>
          <button
            className="ms-button ms-tonal ms-exit"
            onClick={onCancel}
            aria-label="Exit setup"
          >
            <span>Exit setup</span>
            <Icon name="x" />
          </button>
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
                  onClick={() => setStep(1)}
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
                  <SampleCover playlist={playlists[4]} />
                </div>
                <div className="ms-art ms-art-middle">
                  <SampleCover playlist={playlists[1]} />
                </div>
                <div className="ms-art ms-art-front">
                  <SampleCover playlist={playlists[0]} />
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
                <label className="ms-search">
                  <Icon name="search" />
                  <input
                    type="search"
                    aria-label="Search available playlists"
                    placeholder="Find a playlist"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </div>
              <div className="ms-source">
                <SpotifyIcon />
                <span>Sample Spotify library</span>
                <span>{playlists.length} playlists</span>
              </div>
              <fieldset className="ms-playlists">
                <legend className="sr-only">Choose playlists</legend>
                {playlists
                  .filter((playlist) =>
                    playlist.title.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((playlist) => (
                    <label
                      className="ms-playlist"
                      key={playlist.id}
                      data-selected={
                        selected.includes(playlist.id) || undefined
                      }
                    >
                      <div className="ms-playlist-art">
                        <SampleCover playlist={playlist} />
                      </div>
                      <span className="ms-playlist-copy">
                        <span className="ms-playlist-title">
                          {playlist.title}
                        </span>
                        <span className="ms-playlist-meta">
                          {sampleTracks.length} tracks ·{' '}
                          {listeningTime(sampleTracks)}
                        </span>
                      </span>
                      <MusicSelectionControl
                        selectedLabel="Included"
                        unselectedLabel="Include"
                        aria-label={`Select ${playlist.title}`}
                        checked={selected.includes(playlist.id)}
                        onChange={() => toggle(playlist.id)}
                      />
                    </label>
                  ))}
              </fieldset>
              {!playlists.some((playlist) =>
                playlist.title.toLowerCase().includes(search.toLowerCase())
              ) && (
                <p className="ms-empty">
                  No playlists match “{search}”. Try another name.
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
                      <SampleCover playlist={featured} />
                      <div>
                        <h3>{featured.title}</h3>
                        <p>
                          {sampleTracks.length} tracks ·{' '}
                          {listeningTime(sampleTracks)}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  <div className="ms-preview-grid">
                    {collection
                      .filter((playlist) => playlist.id !== lead)
                      .map((playlist) => (
                        <div key={playlist.id}>
                          <SampleCover playlist={playlist} />
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
                  <p>Give one cover more space in the gallery.</p>
                  <label
                    className="ms-feature-option"
                    data-selected={!lead || undefined}
                  >
                    <span className="ms-feature-option-copy">
                      No featured playlist
                      <small>Give every playlist equal space.</small>
                    </span>
                    <MusicSelectionControl
                      type="radio"
                      name="setup-feature"
                      aria-label="No featured playlist"
                      selectedLabel="Selected"
                      unselectedLabel="Choose"
                      checked={!lead}
                      onChange={() => setLead(null)}
                    />
                  </label>
                  {collection.map((playlist) => (
                    <label
                      className="ms-feature-option"
                      key={playlist.id}
                      data-selected={lead === playlist.id || undefined}
                    >
                      <SampleCover playlist={playlist} />
                      <span className="ms-feature-option-copy">
                        {playlist.title}
                      </span>
                      <MusicSelectionControl
                        type="radio"
                        name="setup-feature"
                        aria-label={`Feature ${playlist.title}`}
                        selectedLabel="Featured"
                        unselectedLabel="Feature"
                        checked={lead === playlist.id}
                        onChange={() => setLead(playlist.id)}
                      />
                    </label>
                  ))}
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
