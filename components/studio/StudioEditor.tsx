'use client';

import { useCallback, useEffect, useState } from 'react';

import Button from '@/components/site/Button';

import type { Draft } from '@/lib/studio/types';

import StudioDocumentFrame, {
  StudioDocumentPendingContent,
} from './StudioDocumentFrame';
import StudioDocumentTransition from './StudioDocumentTransition';
import Writing from './StudioWriting';
import { studioRequest } from './api';
import { useWritingCatalog } from './useWritingCatalog';

interface StudioEditorProps {
  id: string;
}

export default function StudioEditor({ id }: StudioEditorProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const catalog = useWritingCatalog();
  const [error, setError] = useState('');
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const [readyDocument, setReadyDocument] = useState<string | null>(null);
  const editorReady = useCallback(() => setReadyDocument(id), [id]);
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setError('');
    studioRequest<Draft>(`/documents/${id}`, { signal })
      .then((document) => {
        if (!signal.aborted) setDraft(document);
      })
      .catch((error) => {
        if (!signal.aborted) setError(error.message);
      });
    return () => {
      controller.abort();
    };
  }, [id, refreshAttempt]);
  const activeDraft = draft?.id === id ? draft : null;
  return (
    <StudioDocumentFrame>
      {activeDraft && error && (
        <section className="studio-notice" role="alert">
          <p>
            Could not refresh this writing. Your open draft is still available.
          </p>
          <p>{error}</p>
          <Button onClick={() => setRefreshAttempt((value) => value + 1)}>
            Retry refresh
          </Button>
        </section>
      )}
      <StudioDocumentTransition
        key={id}
        ready={Boolean(activeDraft && readyDocument === id)}
        pending={
          <StudioDocumentPendingContent
            error={activeDraft ? undefined : error}
          />
        }
      >
        {activeDraft && (
          <Writing
            key={id}
            initial={activeDraft}
            onReady={editorReady}
            interactive={readyDocument === id}
            catalog={catalog}
          />
        )}
      </StudioDocumentTransition>
    </StudioDocumentFrame>
  );
}
