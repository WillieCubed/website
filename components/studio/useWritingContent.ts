import { useCallback, useRef, useState } from 'react';

import type { DraftContent } from '@/lib/studio/types';

import type {
  DraftEditing,
  DraftUpdate,
  WritingSnapshot,
} from './writing-contracts';

/** One owner advances working content and edit versions together, including identical edits. */
export function useWritingContent(
  initial: DraftContent,
  onEdit: (body: DraftContent) => void
): DraftEditing {
  const [body, setBody] = useState(initial);
  const current = useRef(initial);
  const editVersion = useRef(0);
  const update = useCallback(
    (change: DraftUpdate) => {
      const next =
        typeof change === 'function' ? change(current.current) : change;
      editVersion.current += 1;
      current.current = next;
      setBody(next);
      onEdit(next);
    },
    [onEdit]
  );
  const captureSnapshot = useCallback(
    (): WritingSnapshot => ({
      body: current.current,
      editVersion: editVersion.current,
    }),
    []
  );
  const isCurrent = useCallback(
    (snapshot: WritingSnapshot) => snapshot.editVersion === editVersion.current,
    []
  );
  return { body, update, captureSnapshot, isCurrent };
}
