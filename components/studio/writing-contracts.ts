import type { RefObject } from 'react';

import type { Draft, DraftContent } from '@/lib/studio/types';

export type WritingMode = 'write' | 'read' | 'portable';

/** The editor reads the latest draft when a transaction commits. */
export interface DraftEditing {
  body: DraftContent;
  bodyRef: RefObject<DraftContent>;
  update: (body: DraftContent) => void;
}

/** Saved revision capability used by publication, independent of editor presentation. */
export interface WritingDocument extends DraftEditing {
  draft: Draft;
  setDraft: (draft: Draft) => void;
  headRef: RefObject<string>;
  setStatus: (status: string) => void;
  save: () => Promise<boolean>;
}
