'use client';

import { useCallback, useEffect, useState } from 'react';

import Button from '@/components/site/Button';

import { BUILTIN_CATALOG } from '@/lib/studio/catalog';
import type { Draft } from '@/lib/studio/types';

import StudioDocumentFrame, {
  StudioDocumentPendingContent,
} from './StudioDocumentFrame';
import StudioDocumentTransition from './StudioDocumentTransition';
import { type CatalogEntry } from './StudioNodes';
import Writing from './StudioWriting';
import { studioRequest } from './api';

export default function StudioEditor({ id }: { id: string }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [entries, setEntries] = useState<CatalogEntry[]>(BUILTIN_CATALOG);
  const [catalogStatus, setCatalogStatus] = useState('Loading widgets…');
  const [catalogFailed, setCatalogFailed] = useState(false);
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
    studioRequest<{ entries: CatalogEntry[] }>('/catalog', { signal })
      .then((catalog) => {
        if (!signal.aborted) {
          setEntries(catalog.entries);
          setCatalogStatus('');
        }
      })
      .catch(() => {
        if (!signal.aborted) {
          setCatalogFailed(true);
          setCatalogStatus(
            'Widgets could not load. Your writing is still available.'
          );
        }
      });
    return () => {
      controller.abort();
    };
  }, [id, refreshAttempt]);
  async function retryCatalog() {
    setCatalogFailed(false);
    setCatalogStatus('Loading widgets…');
    try {
      const catalog = await studioRequest<{ entries: CatalogEntry[] }>(
        '/catalog'
      );
      setEntries(catalog.entries);
      setCatalogStatus('');
    } catch {
      setCatalogFailed(true);
      setCatalogStatus(
        'Widgets could not load. Your writing is still available.'
      );
    }
  }
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
            entries={entries}
            catalogStatus={catalogStatus}
            retryCatalog={catalogFailed ? retryCatalog : undefined}
          />
        )}
      </StudioDocumentTransition>
    </StudioDocumentFrame>
  );
}
