'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  Draft,
  DraftContent,
  Publication,
  Revision,
} from '@/lib/studio/types';

import type { CatalogEntry } from './StudioNodes';
import type { WritingTask } from './writing-task-definitions';

export type WritingPreview = {
  html: string;
  contentHtml: string;
  portableHtml: string;
  portableText: string;
  issues: unknown[];
};

/** State lifetime is the mounted document, independent of preview and task panels. */
export function useWritingState(initial: Draft, entries: CatalogEntry[]) {
  const [draft, setDraft] = useState(initial);
  const [catalog, setCatalog] = useState(entries);
  useEffect(() => {
    setCatalog((current) => [
      ...entries,
      ...current.filter(
        (entry) =>
          !entries.some(
            (incoming) =>
              incoming.id === entry.id && incoming.version === entry.version
          )
      ),
    ]);
  }, [entries]);
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const [task, setTask] = useState<WritingTask>('write');
  useEffect(() => {
    const address = new URL(window.location.href);
    if (address.searchParams.get('components') !== '1') return;
    setTask('components');
    address.searchParams.delete('components');
    window.history.replaceState(window.history.state, '', address);
  }, []);
  const [media, setMedia] = useState<'link' | 'image' | null>(null);
  const mediaPanel = useRef<HTMLFormElement>(null);
  const [mediaHeight, setMediaHeight] = useState(0);
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [uploading, setUploading] = useState(false);
  const uploadInFlight = useRef(false);
  const [publicationConnectionError, setPublicationConnectionError] =
    useState('');
  const [publicationPollRetry, setPublicationPollRetry] = useState(0);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const cursor = useRef(1);
  const writingSpace = useRef<HTMLDivElement>(null);
  const [activePosition, setActivePosition] = useState(1);
  const [insertionPosition, setInsertionPosition] = useState({
    top: 0,
    bottom: 0,
    boundary: 0,
  });
  const insertAnchor = useRef<Pick<
    DOMRect,
    'left' | 'right' | 'top' | 'bottom'
  > | null>(null);
  const insertionRect = useCallback(() => insertAnchor.current, []);
  const taskRange = useRef({ from: 1, to: 1, scroll: 0 });
  const taskHeading = useRef<HTMLHeadingElement>(null);
  const selectionTools = useRef<HTMLDivElement>(null);
  const [selectionPosition, setSelectionPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reviewedRevision, setReviewedRevision] = useState<number | null>(null);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const [showHeading, setShowHeading] = useState(
    Boolean(initial.head.body.title || initial.head.body.description)
  );
  const [announcement, setAnnouncement] = useState('All changes saved');
  const titleField = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState(initial.head.body);
  const [selection, setSelection] = useState<{
    from: number;
    to: number;
    text: string;
  } | null>(null);
  const bodyRef = useRef(body);
  const headRef = useRef(initial.head.id);
  const saved = useRef(JSON.stringify(body));
  const saving = useRef(false);
  const [saveQueue, setSaveQueue] = useState(0);
  const reviewedBody = useRef<string | null>(null);
  const reviewedRevisionId = useRef<string | null>(null);
  const [status, setStatus] = useState('All changes saved');
  const [conflict, setConflict] = useState(false);
  const conflictRef = useRef(false);
  const [recovery, setRecovery] = useState<DraftContent | null>(null);
  const [mode, setMode] = useState<'write' | 'read' | 'portable'>('write');
  const [preview, setPreview] = useState<WritingPreview | null>(null);
  const [review, setReview] = useState(false);
  const [publication, setPublication] = useState<Publication | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [busy, setBusy] = useState(false);
  const recoveryKey = `studio-draft:${initial.id}`;
  const update = useCallback(
    (next: DraftContent) => {
      bodyRef.current = next;
      setBody(next);
      setPreview(null);
      setReview(false);
      setStatus(
        navigator.onLine
          ? 'Unsaved changes'
          : 'Offline · changes kept in this tab'
      );
      try {
        sessionStorage.setItem(recoveryKey, JSON.stringify(next));
      } catch {
        setStatus('Unsaved changes · browser recovery storage is unavailable');
      }
    },
    [recoveryKey]
  );

  return {
    draft,
    setDraft,
    catalog,
    setCatalog,
    catalogRef,
    task,
    setTask,
    media,
    setMedia,
    mediaPanel,
    mediaHeight,
    setMediaHeight,
    url,
    setUrl,
    alt,
    setAlt,
    uploading,
    setUploading,
    uploadInFlight,
    publicationConnectionError,
    setPublicationConnectionError,
    publicationPollRetry,
    setPublicationPollRetry,
    imageFile,
    setImageFile,
    cursor,
    writingSpace,
    activePosition,
    setActivePosition,
    insertionPosition,
    setInsertionPosition,
    insertAnchor,
    insertionRect,
    taskRange,
    taskHeading,
    selectionTools,
    selectionPosition,
    setSelectionPosition,
    historyLoading,
    setHistoryLoading,
    reviewedRevision,
    setReviewedRevision,
    reviewHeading,
    showHeading,
    setShowHeading,
    announcement,
    setAnnouncement,
    titleField,
    body,
    setBody,
    selection,
    setSelection,
    bodyRef,
    headRef,
    saved,
    saving,
    saveQueue,
    setSaveQueue,
    reviewedBody,
    reviewedRevisionId,
    status,
    setStatus,
    conflict,
    setConflict,
    conflictRef,
    recovery,
    setRecovery,
    mode,
    setMode,
    preview,
    setPreview,
    review,
    setReview,
    publication,
    setPublication,
    revisions,
    setRevisions,
    busy,
    setBusy,
    recoveryKey,
    update,
  };
}
export type WritingState = ReturnType<typeof useWritingState>;
