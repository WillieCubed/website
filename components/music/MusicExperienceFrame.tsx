'use client';
import type { ReactNode } from 'react';

interface Props {
  setup: boolean;
  editing: boolean;
  reordering: boolean;
  loading: boolean;
  loadError?: string;
  ready: boolean;
  interactionLocked: boolean;
  children: ReactNode;
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
      {children}
    </div>
  );
}
