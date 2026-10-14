'use client';
import readingTime from 'reading-time';

import type { Draft } from '@/lib/studio/types';

import type { CatalogEntry } from './StudioNodes';
import { useWritingInteraction } from './useWritingInteraction';
import { useWritingPersistence } from './useWritingPersistence';
import { useWritingPublication } from './useWritingPublication';
import { useWritingState } from './useWritingState';
import { proseText } from './writingText';

export type WritingProps = {
  initial: Draft;
  onReady: () => void;
  interactive: boolean;
  entries: CatalogEntry[];
  catalogStatus: string;
  retryCatalog?: () => void;
};
/** Compose one document session; panels consume this controller without recreating the editor. */
export function useWritingController({
  initial,
  entries,
  onReady,
  interactive,
}: WritingProps) {
  const state = useWritingState(initial, entries);
  const persistence = useWritingPersistence(state, initial);
  const interaction = useWritingInteraction(state, onReady, interactive);
  const publication = useWritingPublication(
    state,
    initial,
    persistence.save,
    interaction.rememberRange
  );
  return {
    ...state,
    ...persistence,
    ...interaction,
    ...publication,
    published: String(
      state.body.frontmatter?.published || state.draft.head.createdAt
    ),
    minutes: Math.ceil(readingTime(proseText(state.body.document)).minutes),
    control: 'site-button site-button-surface',
  };
}
export type WritingController = ReturnType<typeof useWritingController>;
