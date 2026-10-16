import { useCallback, useEffect, useRef, useState } from 'react';

import type { Generation } from '@/lib/studio/types';

import { studioRequest } from './api';

interface WidgetGenerationSession {
  generation: Generation | null;
  connectionError: string;
  acceptGeneration: (generation: Generation) => void;
}

/** New results supersede retained lookups and already-started polls. */
export function useWidgetGeneration(
  documentId: string
): WidgetGenerationSession {
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [connectionError, setConnectionError] = useState('');
  const requestVersion = useRef(0);
  const acceptGeneration = useCallback(
    (result: Generation) => {
      if (result.documentId !== documentId || result.kind !== 'component')
        return;
      requestVersion.current += 1;
      setGeneration(result);
      setConnectionError('');
    },
    [documentId]
  );
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const version = ++requestVersion.current;
    setGeneration(null);
    setConnectionError('');
    try {
      const retained = sessionStorage.getItem(
        `studio-generation:${documentId}`
      );
      if (retained)
        studioRequest<Generation>(`/generations/${retained}`, { signal })
          .then((result) => {
            if (
              !signal.aborted &&
              version === requestVersion.current &&
              result.documentId === documentId &&
              result.kind === 'component' &&
              result.id === retained
            )
              setGeneration(result);
          })
          .catch(() => {});
    } catch {
      /* Browser retention is optional; the active request remains in memory. */
    }
    return () => controller.abort();
  }, [documentId]);
  useEffect(() => {
    if (!generation || generation.documentId !== documentId) return;
    try {
      sessionStorage.setItem(`studio-generation:${documentId}`, generation.id);
    } catch {
      /* Keep the active request in memory. */
    }
  }, [generation, documentId]);
  useEffect(() => {
    if (
      !generation ||
      generation.documentId !== documentId ||
      !['pending', 'running'].includes(generation.status)
    )
      return;
    const controller = new AbortController();
    const { signal } = controller;
    const version = requestVersion.current;
    const timer = setTimeout(() => {
      studioRequest<Generation>(`/generations/${generation.id}`, { signal })
        .then((result) => {
          if (
            !signal.aborted &&
            version === requestVersion.current &&
            result.documentId === documentId &&
            result.kind === 'component' &&
            result.id === generation.id
          ) {
            setGeneration(result);
            setConnectionError('');
          }
        })
        .catch((error) => {
          if (!signal.aborted && version === requestVersion.current)
            setConnectionError(error.message);
        });
    }, 2500);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [generation, documentId]);
  return {
    generation: generation?.documentId === documentId ? generation : null,
    connectionError,
    acceptGeneration,
  };
}
