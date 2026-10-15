'use client';
import type { ReactNode } from 'react';

interface LayoutProps {
  setup: boolean;
  children: ReactNode;
  setupView: ReactNode;
  chrome: ReactNode;
  overlays: ReactNode;
  publicEmpty: boolean;
}

interface Props extends LayoutProps {
  editing: boolean;
  reordering: boolean;
  loading: boolean;
  loadError?: string;
  ready: boolean;
  interactionLocked: boolean;
}
export default function MusicExperienceFrame({
  setup,
  editing,
  reordering,
  loading,
  loadError,
  ready,
  interactionLocked,
  children,
  setupView,
  chrome,
  overlays,
  publicEmpty,
}: Props) {
  return (
    <div
      className="music-prototype"
      data-editing={(!setup && editing) || undefined}
      data-reordering={(!setup && editing && reordering) || undefined}
      aria-busy={(loading && !loadError) || !ready || interactionLocked}
      aria-disabled={interactionLocked || undefined}
      inert={interactionLocked}
    >
      <MusicExperienceLayout
        setup={setup}
        setupView={setupView}
        chrome={chrome}
        overlays={overlays}
        publicEmpty={publicEmpty}
      >
        {children}
      </MusicExperienceLayout>
    </div>
  );
}

function MusicExperienceLayout({
  setup,
  setupView,
  chrome,
  overlays,
  publicEmpty,
  children,
}: LayoutProps) {
  return (
    <>
      {setup && setupView}
      {!setup && chrome}
      {/* The series form keeps its draft while setup temporarily replaces the gallery. */}
      <main
        hidden={setup}
        id={setup ? undefined : 'main'}
        className={`mp-shell${publicEmpty ? ' mp-shell-public-empty' : ''}`}
      >
        {children}
      </main>
      {!setup && overlays}
    </>
  );
}
