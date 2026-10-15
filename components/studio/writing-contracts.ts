import type { Draft, DraftContent, Revision } from '@/lib/studio/types';

export type WritingPreviewMode = 'read' | 'portable';
export type WritingMode = 'write' | WritingPreviewMode;

export interface WritingRange {
  from: number;
  to: number;
}

export interface WritingReturnPoint extends WritingRange {
  scroll: number;
}

export interface WritingTextSelection extends WritingRange {
  text: string;
}

export interface WritingInsertionBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export type DraftUpdate =
  | DraftContent
  | ((current: DraftContent) => DraftContent);
export interface WritingSnapshot {
  body: DraftContent;
  editVersion: number;
}

/** The editor commits against the latest working body without owning persistence. */
export interface DraftEditing {
  body: DraftContent;
  update: (update: DraftUpdate) => void;
  captureSnapshot: () => WritingSnapshot;
  isCurrent: (snapshot: WritingSnapshot) => boolean;
}

/** Persistence operations keep save/recovery internals inside the document owner. */
export interface WritingDocument extends DraftEditing {
  draft: Draft;
  dirty: boolean;
  status: string;
  reportStatus: (message: string) => void;
  conflict: boolean;
  recovery: DraftContent | null;
  recoverChanges: (replaceDocument: (body: DraftContent) => void) => void;
  discardRecovery: () => void;
  rebaseChanges: () => Promise<void>;
  save: () => Promise<boolean>;
  selectSavedRevision: (snapshot: WritingSnapshot) => Promise<Revision | null>;
  refreshPublicationMetadata: () => Promise<void>;
}
