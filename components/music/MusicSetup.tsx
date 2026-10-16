'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { type ComponentType, type RefObject } from 'react';

import Icon from '@/components/icons/Icon';
import SpotifyIcon from '@/components/icons/SpotifyIcon';
import PaletteTrigger from '@/components/search/palette/PaletteTrigger';

import {
  type Catalog,
  type MusicMode,
  type PlaylistView,
  listeningTime,
} from '@/lib/music/presentation';

import MusicCover, { type MusicCoverProps } from './MusicCover';
import MusicSelectionControl from './MusicSelectionControl';
import './music-setup.css';
import { useMusicSetupPalette } from './useMusicSetupPalette';

const steps = ['Connect', 'Choose', 'Preview'];

interface MusicSetupProps {
  catalog: Catalog;
  playlists: PlaylistView[];
  Cover?: ComponentType<MusicCoverProps>;
  mode?: MusicMode;
  connected?: boolean;
  onConnect?: () => Promise<void>;
  onCancel: () => void;
  onComplete: (catalog: Catalog) => void;
}

export default function MusicSetup({
  catalog,
  playlists: library,
  Cover = MusicCover,
  mode = 'public',
  connected = false,
  onConnect,
  onCancel,
  onComplete,
}: MusicSetupProps) {
  const playlists = useMemo(
    () =>
      mode === 'admin'
        ? library.filter((playlist) => playlist.eligible)
        : library,
    [library, mode]
  );
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
  function continueSetup() {
    if (step === 1) {
      setStep(2);
      return;
    }
    onComplete({
      ...catalog,
      selected: collection.map((playlist) => playlist.id),
      lead,
    });
  }

  useMusicSetupPalette({ enabled: step === 1, playlists, selected, toggle });

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
            <ConnectStep
              title={title}
              mode={mode}
              playlists={playlists}
              Cover={Cover}
              onConnect={() =>
                mode === 'prototype' ? setStep(1) : void onConnect?.()
              }
            />
          ) : step === 1 ? (
            <ChooseStep
              title={title}
              mode={mode}
              playlists={playlists}
              Cover={Cover}
              selected={selected}
              toggle={toggle}
            />
          ) : (
            <PreviewStep
              title={title}
              collection={collection}
              featured={featured}
              Cover={Cover}
              lead={lead}
              setLead={setLead}
            />
          )}
        </main>
        <SetupActions
          step={step}
          selectedCount={selected.length}
          onBack={() => setStep(step - 1)}
          onContinue={continueSetup}
        />
      </div>
    </>
  );
}

interface StepHeading {
  title: RefObject<HTMLHeadingElement | null>;
  Cover: ComponentType<MusicCoverProps>;
}
interface ConnectStepProps extends StepHeading {
  mode: MusicMode;
  playlists: PlaylistView[];
  onConnect: () => void;
}
function ConnectStep({ title, playlists, Cover, onConnect }: ConnectStepProps) {
  return (
    <section className="ms-connect" aria-labelledby="ms-title">
      <div className="ms-connect-copy">
        <h1 id="ms-title" ref={title} tabIndex={-1}>
          Your playlists.
          <br />
          Your call.
        </h1>
        <p className="ms-intro">
          Bring your Spotify playlists here. Choose what belongs, give your
          favorites room, and keep every track in its place.
        </p>
        <button
          className="ms-button ms-primary ms-connect-button"
          onClick={onConnect}
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
          {playlists[4] != null ? (
            <Cover playlist={playlists[4]} />
          ) : (
            <SpotifyIcon />
          )}
        </div>
        <div className="ms-art ms-art-middle">
          {playlists[1] != null ? (
            <Cover playlist={playlists[1]} />
          ) : (
            <Icon name="music" />
          )}
        </div>
        <div className="ms-art ms-art-front">
          {playlists[0] != null ? (
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
  );
}
interface ChooseStepProps extends StepHeading {
  mode: MusicMode;
  playlists: PlaylistView[];
  selected: string[];
  toggle: (id: string) => void;
}

function ChooseStep({
  title,
  mode,
  playlists,
  Cover,
  selected,
  toggle,
}: ChooseStepProps) {
  return (
    <section aria-labelledby="ms-title">
      <div className="ms-selection-heading">
        <div>
          <h1 id="ms-title" ref={title} tabIndex={-1}>
            What belongs here?
          </h1>
          <p className="ms-intro">
            Choose the playlists you want in your collection. You can change
            this later.
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
              <span className="ms-playlist-title">{playlist.title}</span>
              <span className="ms-playlist-meta">
                {playlist.trackCount} tracks · {listeningTime(playlist.tracks)}
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
          No owned public playlists are available. Make a playlist public on
          Spotify, then refresh your library.
        </p>
      )}
    </section>
  );
}
interface PreviewStepProps extends StepHeading {
  collection: PlaylistView[];
  featured?: PlaylistView;
  lead: string | null;
  setLead: (id: string | null) => void;
}

function PreviewStep({
  title,
  collection,
  featured,
  Cover,
  lead,
  setLead,
}: PreviewStepProps) {
  return (
    <section aria-labelledby="ms-title">
      <h1 id="ms-title" ref={title} tabIndex={-1}>
        Give it your shape.
      </h1>
      <p className="ms-intro">
        Put one playlist up front, or give them equal space. Order, notes, and
        series come next.
      </p>
      <div className="ms-preview-layout">
        <div className="ms-gallery-preview" aria-label="Collection preview">
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
            <span className="ms-feature-option-copy">No featured playlist</span>
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
                <span className="ms-feature-option-copy">{playlist.title}</span>
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
  );
}

interface SetupActionsProps {
  step: number;
  selectedCount: number;
  onBack: () => void;
  onContinue: () => void;
}

function SetupActions({
  step,
  selectedCount,
  onBack,
  onContinue,
}: SetupActionsProps) {
  return (
    step > 0 && (
      <div className="ms-actions" role="group" aria-label="Setup actions">
        <button className="ms-button ms-tonal" onClick={onBack}>
          <Icon name="arrow-left" />
          Back
        </button>
        <p role="status">
          {step === 1
            ? `${selectedCount} selected`
            : 'Nothing goes live from setup.'}
        </p>
        <button
          className="ms-button ms-primary"
          disabled={selectedCount === 0}
          onClick={onContinue}
        >
          {step === 1 ? 'Preview collection' : 'Continue to curation'}
          <Icon name="arrow-right" />
        </button>
      </div>
    )
  );
}
