'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import Icon from '@/components/icons/Icon';
import PaletteTrigger from '@/components/search/palette/PaletteTrigger';
import Button from '@/components/site/Button';

import { type Catalog, type PlaylistView } from '@/lib/music/presentation';

import MusicSetupChoose from './MusicSetupChoose';
import MusicSetupConnect from './MusicSetupConnect';
import MusicSetupPreview from './MusicSetupPreview';
import './music-setup.css';
import { useMusicSetupPalette } from './useMusicSetupPalette';

const steps = ['Connect', 'Choose', 'Preview'];

interface MusicSetupProps {
  catalog: Catalog;
  playlists: PlaylistView[];
  connected?: boolean;
  onConnect?: () => Promise<void>;
  onCancel: () => void;
  onComplete: (catalog: Catalog) => void;
}

export default function MusicSetup({
  catalog,
  playlists: library,
  connected = false,
  onConnect,
  onCancel,
  onComplete,
}: MusicSetupProps) {
  const playlists = useMemo(
    () => library.filter((playlist) => playlist.eligible),
    [library]
  );
  const [step, setStep] = useState(connected ? 1 : 0);
  const [selected, setSelected] = useState<string[]>(() =>
    catalog.selected.filter((id) => playlists.some((p) => p.id === id))
  );
  const [lead, setLead] = useState<string | null>(catalog.lead);
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
      <div className="ms-shell">
        <header className="ms-header">
          <span className="ms-wordmark">Music</span>
          <div className="ms-header-actions">
            <PaletteTrigger size="compact" />
            <Button
              className="ms-exit"
              variant="quiet"
              size="small"
              onClick={onCancel}
              aria-label="Exit setup"
            >
              <span>Exit setup</span>
              <Icon name="x" />
            </Button>
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
            <MusicSetupConnect
              title={title}
              playlists={playlists}
              onConnect={() => void onConnect?.()}
            />
          ) : step === 1 ? (
            <MusicSetupChoose
              title={title}
              playlists={playlists}
              selected={selected}
              toggle={toggle}
            />
          ) : (
            <MusicSetupPreview
              title={title}
              collection={collection}
              featured={featured}
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
        <button
          className="site-control ms-button music-tonal"
          data-control-size="medium"
          onClick={onBack}
        >
          <Icon name="arrow-left" />
          Back
        </button>
        <p role="status">
          {step === 1
            ? `${selectedCount} selected`
            : 'Nothing goes live from setup.'}
        </p>
        <button
          className="site-control ms-button music-primary"
          data-control-size="medium"
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
