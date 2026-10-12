'use client';
import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect, useRef, useState } from 'react';
import readingTime from 'reading-time';

import SiteLink from '@/components/link/SiteLink';
import Popover from '@/components/site/Popover';
import TopBar from '@/components/site/TopBar';

import { formatDate, site } from '@/lib/site';
import type {
  Draft,
  DraftContent,
  EditorNode,
  Publication,
  Revision,
} from '@/lib/studio/types';

import { type CatalogEntry, MdxSource, makeCatalogBlock } from './StudioNodes';
import StudioPreview from './StudioPreview';
import StudioWidgetGenerator from './StudioWidgetGenerator';
import { studioRequest } from './api';

type Preview = {
  html: string;
  contentHtml: string;
  portableHtml: string;
  portableText: string;
  issues: unknown[];
};
function proseText(node: EditorNode): string {
  return [
    node.text || '',
    node.type === 'mdxSource' ? String(node.attrs?.source || '') : '',
    node.type === 'catalogBlock'
      ? [
          String(node.attrs?.children || ''),
          ...Object.values(
            (node.attrs?.props as Record<string, unknown>) || {}
          ).filter((value) => typeof value === 'string'),
        ].join(' ')
      : '',
    ...(node.content || []).map(proseText),
  ].join(' ');
}
export default function StudioEditor({ id }: { id: string }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [entries, setEntries] = useState<CatalogEntry[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    Promise.all([
      studioRequest<Draft>(`/documents/${id}`),
      studioRequest<{ entries: CatalogEntry[] }>('/catalog'),
    ])
      .then(([document, catalog]) => {
        if (alive) {
          setDraft(document);
          setEntries(catalog.entries);
        }
      })
      .catch((error) => {
        if (alive) setError(error.message);
      });
    return () => {
      alive = false;
    };
  }, [id]);
  return draft && entries && !error ? (
    <Writing key={id} initial={draft} entries={entries} />
  ) : (
    <>
      <TopBar
        column="reading"
        crumbs={[{ label: 'Your writings', href: '/studio' }]}
      />
      <main
        id="main"
        className="mx-auto max-w-breakpoint-md px-lg pt-10 pb-10 desktop:px-0"
      >
        {error ? (
          <>
            <p role="alert" className="text-body-large">
              {error}
            </p>
            <SiteLink
              href="/studio"
              className="mt-4 inline-block link-animated"
            >
              Your writings
            </SiteLink>
          </>
        ) : (
          <p role="status" className="text-body-large text-muted">
            Opening your writing…
          </p>
        )}
      </main>
    </>
  );
}

function Writing({
  initial,
  entries,
}: {
  initial: Draft;
  entries: CatalogEntry[];
}) {
  const [draft, setDraft] = useState(initial);
  const [catalog, setCatalog] = useState(entries);
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const [task, setTask] = useState<
    'write' | 'details' | 'components' | 'history'
  >('write');
  useEffect(() => {
    const address = new URL(window.location.href);
    if (address.searchParams.get('components') !== '1') return;
    setTask('components');
    address.searchParams.delete('components');
    window.history.replaceState(window.history.state, '', address);
  }, []);
  const [media, setMedia] = useState<'link' | 'image' | null>(null);
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const cursor = useRef(1);
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
  const [preview, setPreview] = useState<Preview | null>(null);
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
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image,
      TableKit,
      Markdown,
      MdxSource,
      makeCatalogBlock(() => catalogRef.current),
    ],
    // Activity may recreate Tiptap when returning to a cached route.
    content: bodyRef.current.document,
    editorProps: {
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === '/') {
          event.preventDefault();
          insertAnchor.current = _view.coordsAtPos(_view.state.selection.from);
          (
            document.querySelector(
              '[aria-label="Insert into writing"]'
            ) as HTMLButtonElement | null
          )?.click();
          return true;
        }
        return false;
      },
      attributes: {
        'aria-label': 'Writing content',
        class: `studio-prose prose prose-theme ${body.postType === 'note' ? 'prose-xl [&_p]:text-body-large' : 'prose-lg [&_p]:text-body-medium'} [&_p]:my-4 [&_p]:leading-relaxed [&_p]:text-on-surface max-w-none prose-headings:scroll-mt-20`,
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor }) =>
      update({ ...bodyRef.current, document: editor.getJSON() }),
    onSelectionUpdate: ({ editor }) => {
      const { from, to, $from, $to } = editor.state.selection;
      cursor.current = from;
      let textOnly = true;
      $from.parent.forEach((node) => {
        if (!node.isText) textOnly = false;
      });
      setSelection(
        from < to &&
          $from.parent === $to.parent &&
          ['paragraph', 'heading'].includes($from.parent.type.name) &&
          textOnly
          ? { from, to, text: editor.state.doc.textBetween(from, to) }
          : null
      );
    },
  });
  useEffect(() => {
    if (
      !editor ||
      new URLSearchParams(window.location.search).get('compose') !== '1'
    )
      return;
    // Consume the entry intent, so reopening or reloading does not summon a keyboard.
    const address = new URL(window.location.href);
    address.searchParams.delete('compose');
    window.history.replaceState(window.history.state, '', address);
    editor.commands.focus('end', { scrollIntoView: false });
  }, [editor]);
  const previousMode = useRef(mode);
  useEffect(() => {
    if (previousMode.current === 'write' && mode !== 'write')
      reviewHeading.current?.focus();
    previousMode.current = mode;
  }, [mode]);
  useEffect(() => {
    if (status === 'Unsaved changes' || status === 'Saving…') return;
    const timer = setTimeout(() => setAnnouncement(status), 600);
    return () => clearTimeout(timer);
  }, [status]);
  useEffect(() => {
    if (!editor || !selection || task !== 'write' || mode !== 'write') {
      setSelectionPosition(null);
      return;
    }
    const place = () => {
      try {
        const start = editor.view.coordsAtPos(selection.from);
        const end = editor.view.coordsAtPos(selection.to);
        if (end.bottom < 0 || start.top > innerHeight) {
          setSelectionPosition(null);
          return;
        }
        const width = selectionTools.current?.offsetWidth || 300;
        const height = selectionTools.current?.offsetHeight || 60;
        setSelectionPosition({
          left: Math.max(16, Math.min(start.left, innerWidth - width - 16)),
          top:
            start.top >= height + 16
              ? start.top - height - 8
              : Math.min(end.bottom + 8, innerHeight - height - 16),
        });
      } catch {
        setSelectionPosition(null);
      }
    };
    const frame = requestAnimationFrame(place);
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
  }, [editor, selection, task, mode]);
  useEffect(() => {
    try {
      const local = sessionStorage.getItem(recoveryKey);
      if (local && local !== saved.current) setRecovery(JSON.parse(local));
    } catch {
      /* The server revision remains available. */
    }
  }, [recoveryKey]);
  const save = useCallback(async (): Promise<boolean> => {
    if (saving.current || conflictRef.current) return false;
    const snapshot = bodyRef.current;
    const serialized = JSON.stringify(snapshot);
    if (serialized === saved.current) return true;
    if (!navigator.onLine) {
      setStatus('Offline · changes kept in this tab');
      return false;
    }
    saving.current = true;
    let committed = false;
    setStatus('Saving…');
    try {
      const next = await studioRequest<Draft>(`/documents/${initial.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          expectedRevisionId: headRef.current,
          body: snapshot,
        }),
      });
      headRef.current = next.head.id;
      saved.current = serialized;
      committed = true;
      setDraft(next);
      setStatus(
        serialized === JSON.stringify(bodyRef.current)
          ? 'All changes saved'
          : 'Unsaved changes'
      );
      if (serialized === JSON.stringify(bodyRef.current))
        sessionStorage.removeItem(recoveryKey);
      return serialized === JSON.stringify(bodyRef.current);
    } catch (error) {
      if ((error as { status?: number }).status === 409) {
        conflictRef.current = true;
        setConflict(true);
        setStatus(
          'Another revision was saved. Your changes are kept in this tab.'
        );
      } else setStatus(`Could not save · ${(error as Error).message}`);
      return false;
    } finally {
      saving.current = false;
      if (committed && serialized !== JSON.stringify(bodyRef.current))
        setSaveQueue((value) => value + 1);
    }
  }, [initial.id, recoveryKey]);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!recovery) void save();
    }, 1000);
    return () => clearTimeout(timer);
  }, [body, save, recovery, saveQueue]);
  useEffect(() => {
    const online = () => {
      void save();
    };
    const offline = () => setStatus('Offline · changes kept in this tab');
    const leave = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(bodyRef.current) !== saved.current)
        event.preventDefault();
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('beforeunload', leave);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('beforeunload', leave);
    };
  }, [save]);
  useEffect(() => {
    try {
      const retained = sessionStorage.getItem(
        `studio-publication:${initial.id}`
      );
      if (retained)
        studioRequest<Publication>(`/publications/${retained}`)
          .then(setPublication)
          .catch((error) => setStatus(error.message));
    } catch {
      /* Saved writing remains available without browser recovery storage. */
    }
  }, [initial.id]);
  useEffect(() => {
    if (publication) {
      try {
        sessionStorage.setItem(
          `studio-publication:${initial.id}`,
          publication.id
        );
      } catch {
        /* Poll the publication for this visit. */
      }
    }
  }, [publication, initial.id]);
  useEffect(() => {
    if (!publication || ['live', 'failed'].includes(publication.status)) return;
    const timer = setTimeout(() => {
      studioRequest<Publication>(`/publications/${publication.id}`)
        .then(setPublication)
        .catch((error) => setStatus(error.message));
    }, 2500);
    return () => clearTimeout(timer);
  }, [publication]);
  function rememberRange() {
    if (editor)
      taskRange.current = {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
        scroll: window.scrollY,
      };
  }
  function openTask(next: 'details' | 'components' | 'history') {
    // Native keyboard selection may precede ProseMirror's selectionchange read.
    const native = window.getSelection();
    if (
      editor &&
      native?.anchorNode &&
      native.focusNode &&
      editor.view.dom.contains(native.anchorNode) &&
      editor.view.dom.contains(native.focusNode)
    ) {
      const anchor = editor.view.posAtDOM(
        native.anchorNode,
        native.anchorOffset
      );
      const focus = editor.view.posAtDOM(native.focusNode, native.focusOffset);
      editor.commands.setTextSelection({
        from: Math.min(anchor, focus),
        to: Math.max(anchor, focus),
      });
    }
    rememberRange();
    setTask(next);
  }
  function returnToWriting() {
    setTask('write');
    setMode('write');
    setReview(false);
    setMedia(null);
    requestAnimationFrame(() => {
      if (!editor) return;
      editor.view.focus();
      editor.commands.setTextSelection({
        from: Math.min(taskRange.current.from, editor.state.doc.content.size),
        to: Math.min(taskRange.current.to, editor.state.doc.content.size),
      });
      window.scrollTo({ top: taskRange.current.scroll });
    });
  }
  useEffect(() => {
    if (task !== 'write') taskHeading.current?.focus();
  }, [task]);
  useEffect(() => {
    if (publication?.status === 'live')
      studioRequest<Draft>(`/documents/${initial.id}`)
        .then(setDraft)
        .catch((error) => setStatus(error.message));
  }, [publication?.status, initial.id]);
  async function generatePreview(
    nextMode: 'read' | 'portable',
    publishing = false
  ) {
    rememberRange();
    const snapshot = JSON.stringify(bodyRef.current);
    setBusy(true);
    if (publishing) {
      if (!(await save())) {
        setStatus('Save your changes before reviewing publication.');
        setBusy(false);
        return;
      }
      if (snapshot !== JSON.stringify(bodyRef.current)) {
        setStatus('Your writing changed. Review it again.');
        setBusy(false);
        return;
      }
      try {
        const current = await studioRequest<Draft>(`/documents/${draft.id}`);
        if (snapshot !== JSON.stringify(bodyRef.current)) {
          setStatus('Your writing changed. Review it again.');
          setBusy(false);
          return;
        }
        if (current.head.id !== headRef.current) {
          setStatus(
            'A newer revision exists. Load it before reviewing publication.'
          );
          setBusy(false);
          return;
        }
        setReviewedRevision(current.head.number);
        reviewedRevisionId.current = current.head.id;
      } catch (error) {
        setStatus((error as Error).message);
        setBusy(false);
        return;
      }
    }
    try {
      const next = await studioRequest<Preview>('/preview', {
        method: 'POST',
        body: JSON.stringify({ body: JSON.parse(snapshot), slug: draft.slug }),
      });
      if (snapshot !== JSON.stringify(bodyRef.current)) {
        setStatus(
          'Your writing changed while the preview loaded. Review it again.'
        );
        return;
      }
      reviewedBody.current = publishing ? snapshot : null;
      setPreview(next);
      setMode(nextMode);
      setReview(publishing);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    if (
      !reviewedBody.current ||
      !reviewedRevisionId.current ||
      reviewedBody.current !== JSON.stringify(bodyRef.current)
    ) {
      setReview(false);
      setStatus(
        'Your writing changed. Review the current draft before publishing.'
      );
      return;
    }
    setBusy(true);
    try {
      if (!(await save())) {
        setStatus('Save your changes before publishing.');
        return;
      }
      if (reviewedBody.current !== JSON.stringify(bodyRef.current)) {
        setReview(false);
        setStatus('Your writing changed during saving. Review it again.');
        return;
      }
      const next = await studioRequest<Publication>('/publications', {
        method: 'POST',
        body: JSON.stringify({
          documentId: draft.id,
          revisionId: reviewedRevisionId.current,
        }),
      });
      setPublication(next);
      setReview(false);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reloadHead() {
    try {
      const remote = await studioRequest<Draft>(`/documents/${draft.id}`);
      headRef.current = remote.head.id;
      saved.current = JSON.stringify(remote.head.body);
      setDraft(remote);
      conflictRef.current = false;
      setConflict(false);
      setStatus(
        'Latest revision loaded. Your retained changes are ready to save as a new revision.'
      );
    } catch (error) {
      setStatus((error as Error).message);
    }
  }
  async function upload() {
    if (!imageFile || !editor || !alt.trim()) return;
    const data = new FormData();
    data.append('file', imageFile);
    setStatus('Uploading image…');
    try {
      const asset = await studioRequest<{ url: string }>('/assets', {
        method: 'POST',
        body: data,
      });
      editor
        .chain()
        .focus()
        .setTextSelection(cursor.current)
        .setImage({ src: asset.url, alt })
        .run();
      setMedia(null);
      setAlt('');
      setImageFile(null);
    } catch (error) {
      setStatus((error as Error).message);
    }
  }
  function insert(entry: CatalogEntry) {
    editor?.commands.setTextSelection(
      Math.min(cursor.current, editor.state.doc.content.size)
    );
    editor?.commands.insertContent({
      type: 'catalogBlock',
      attrs: {
        id: entry.id,
        version: entry.version,
        props: entry.example,
        children: '',
      },
    });
    editor?.commands.focus();
    setTask('write');
  }
  function closePopover(event: React.MouseEvent) {
    (
      event.currentTarget.closest('[popover]') as HTMLElement | null
    )?.hidePopover();
  }
  async function history() {
    openTask('history');
    setHistoryLoading(true);
    try {
      const result = await studioRequest<
        Revision[] | { revisions: Revision[] }
      >(`/documents/${draft.id}/revisions`);
      setRevisions(Array.isArray(result) ? result : result.revisions);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  }
  const published = String(body.frontmatter?.published || draft.head.createdAt);
  const minutes = Math.ceil(readingTime(proseText(body.document)).minutes);
  const control = 'feeds-button';
  return (
    <>
      <TopBar
        column="reading"
        crumbs={[{ label: 'Your writings', href: '/studio' }]}
      />
      <main id="main" className="studio-editor">
        <div className="mx-auto max-w-breakpoint-md px-lg desktop:px-0">
          {recovery && (
            <section className="studio-notice" aria-label="Recovered writing">
              <p>There are unsaved changes from your last visit.</p>
              <button
                className={control}
                onClick={() => {
                  editor?.commands.setContent(recovery.document);
                  update(recovery);
                  setRecovery(null);
                }}
              >
                Recover changes
              </button>
              <button
                className={control}
                onClick={() => {
                  sessionStorage.removeItem(recoveryKey);
                  setRecovery(null);
                }}
              >
                Keep saved revision
              </button>
            </section>
          )}
          {conflict && (
            <section className="studio-notice" role="alert">
              <p>
                A newer revision exists. Your writing is still here. Load its
                revision number before explicitly saving your retained changes.
              </p>
              <button className={control} onClick={reloadHead}>
                Keep my changes against latest revision
              </button>
            </section>
          )}
          {mode === 'write' ? (
            <>
              <header className="studio-writing-header pb-10 pt-10">
                <h1 className="sr-only">{body.title || 'Untitled writing'}</h1>
                {body.postType === 'article' &&
                  (showHeading || body.title || body.description) && (
                    <div className="space-y-2">
                      <label className="sr-only" htmlFor="writing-title">
                        Title
                      </label>
                      <textarea
                        ref={titleField}
                        id="writing-title"
                        rows={1}
                        className="studio-inline-title text-headline-medium desktop:text-headline-large"
                        value={body.title}
                        placeholder="Untitled writing"
                        onChange={(event) =>
                          update({
                            ...bodyRef.current,
                            title: event.target.value.replace(/\n/g, ' '),
                          })
                        }
                      />
                      <label className="sr-only" htmlFor="writing-description">
                        Description
                      </label>
                      <textarea
                        id="writing-description"
                        rows={1}
                        className="studio-inline-summary text-body-large text-accent"
                        value={body.description}
                        placeholder="Add a description"
                        onChange={(event) =>
                          update({
                            ...bodyRef.current,
                            description: event.target.value,
                          })
                        }
                      />
                    </div>
                  )}
                <div
                  className={`studio-byline ${body.postType === 'article' ? 'mt-5 ' : ''}flex flex-wrap items-center gap-x-2 gap-y-2 text-label-large text-muted`}
                >
                  <Popover
                    label="Edit writing date"
                    trigger={
                      <time dateTime={published}>{formatDate(published)}</time>
                    }
                    triggerClassName="studio-inline-trigger"
                    panelClassName="studio-task-form"
                    width={280}
                  >
                    <label>
                      Writing date
                      <input
                        type="date"
                        value={published.slice(0, 10)}
                        onChange={(event) =>
                          update({
                            ...bodyRef.current,
                            frontmatter: {
                              ...bodyRef.current.frontmatter,
                              published: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                  </Popover>
                  {body.postType === 'article' && minutes > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{minutes} min read</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>
                    {!draft.liveRevisionId
                      ? 'Draft'
                      : draft.liveRevisionId === draft.head.id &&
                          JSON.stringify(body) === saved.current
                        ? 'Published'
                        : 'Unpublished changes'}
                  </span>
                  {body.postType === 'article' &&
                    !showHeading &&
                    !body.title &&
                    !body.description && (
                      <button
                        className="studio-inline-trigger"
                        onClick={() => {
                          setShowHeading(true);
                          requestAnimationFrame(() =>
                            titleField.current?.focus()
                          );
                        }}
                      >
                        Add a title
                      </button>
                    )}
                  <div className="studio-editor-context text-label-large text-muted">
                    <div
                      role="status"
                      aria-live="off"
                      className="studio-save-state"
                    >
                      <span aria-hidden="true">
                        {status === 'All changes saved'
                          ? 'Saved'
                          : status === 'Unsaved changes'
                            ? 'Editing'
                            : status}
                      </span>
                      <span className="sr-only">{status}</span>
                    </div>
                    <span className="sr-only" aria-live="polite">
                      {announcement}
                    </span>
                    <Popover
                      label="Writing actions"
                      trigger="Actions"
                      triggerClassName={control}
                      panelClassName="studio-action-menu"
                      align="end"
                      width={260}
                    >
                      <button
                        onClick={(event) => {
                          closePopover(event);
                          openTask('details');
                        }}
                      >
                        Writing details
                      </button>
                      <button
                        onClick={(event) => {
                          closePopover(event);
                          void history();
                        }}
                      >
                        Revision history
                      </button>
                      <button
                        disabled={conflict || !!recovery}
                        onClick={(event) => {
                          closePopover(event);
                          void save();
                        }}
                      >
                        Save now
                      </button>
                      <button
                        disabled={!editor?.can().undo()}
                        onClick={(event) => {
                          closePopover(event);
                          editor?.chain().focus().undo().run();
                        }}
                      >
                        Undo
                      </button>
                      <button
                        disabled={!editor?.can().redo()}
                        onClick={(event) => {
                          closePopover(event);
                          editor?.chain().focus().redo().run();
                        }}
                      >
                        Redo
                      </button>
                      <button
                        disabled={busy}
                        onClick={(event) => {
                          closePopover(event);
                          void generatePreview('read');
                        }}
                      >
                        Read preview
                      </button>
                      <button
                        disabled={busy || conflict || !!recovery}
                        onClick={(event) => {
                          closePopover(event);
                          void generatePreview('read', true);
                        }}
                      >
                        Review publication
                      </button>
                    </Popover>
                  </div>
                  <div
                    className="studio-insertion-row"
                    onKeyDownCapture={(event) => {
                      if (event.key === 'Escape' && insertAnchor.current) {
                        insertAnchor.current = null;
                        requestAnimationFrame(() =>
                          editor?.commands.focus(null, {
                            scrollIntoView: false,
                          })
                        );
                      }
                    }}
                    onPointerDownCapture={() => {
                      insertAnchor.current = null;
                    }}
                  >
                    <Popover
                      anchorRect={insertionRect}
                      label="Insert into writing"
                      trigger="Add"
                      triggerClassName={control}
                      panelClassName="studio-action-menu"
                      width={280}
                    >
                      <button
                        aria-pressed={
                          editor?.isActive('heading', { level: 2 }) || false
                        }
                        onClick={(event) => {
                          closePopover(event);
                          editor
                            ?.chain()
                            .focus()
                            .toggleHeading({ level: 2 })
                            .run();
                        }}
                      >
                        Heading
                      </button>
                      <button
                        aria-pressed={editor?.isActive('bulletList') || false}
                        onClick={(event) => {
                          closePopover(event);
                          editor?.chain().focus().toggleBulletList().run();
                        }}
                      >
                        List
                      </button>
                      <button
                        aria-pressed={editor?.isActive('blockquote') || false}
                        onClick={(event) => {
                          closePopover(event);
                          editor?.chain().focus().toggleBlockquote().run();
                        }}
                      >
                        Quote
                      </button>
                      <button
                        aria-pressed={editor?.isActive('codeBlock') || false}
                        onClick={(event) => {
                          closePopover(event);
                          editor?.chain().focus().toggleCodeBlock().run();
                        }}
                      >
                        Code
                      </button>
                      <button
                        onClick={(event) => {
                          closePopover(event);
                          editor
                            ?.chain()
                            .focus()
                            .insertTable({
                              rows: 3,
                              cols: 3,
                              withHeaderRow: true,
                            })
                            .run();
                        }}
                      >
                        Table
                      </button>
                      <button
                        onClick={(event) => {
                          closePopover(event);
                          setMedia('image');
                        }}
                      >
                        Image
                      </button>
                      {catalog.map((entry) => (
                        <button
                          key={`${entry.id}:${entry.version}`}
                          title={entry.description}
                          aria-label={entry.name}
                          aria-description={entry.description}
                          onClick={(event) => {
                            closePopover(event);
                            insert(entry);
                          }}
                        >
                          <span>{entry.name}</span>
                          <span className="block text-body-small text-muted">
                            {entry.description}
                          </span>
                        </button>
                      ))}
                      <button
                        onClick={(event) => {
                          closePopover(event);
                          openTask('components');
                        }}
                      >
                        Create widget…
                      </button>
                    </Popover>
                  </div>
                </div>
              </header>
              {task !== 'write' && (
                <section
                  className="studio-task"
                  aria-label={
                    task === 'components'
                      ? 'Widget generator'
                      : task === 'history'
                        ? 'Revision history'
                        : 'Writing details'
                  }
                >
                  <div className="studio-task-heading">
                    <h2
                      ref={taskHeading}
                      tabIndex={-1}
                      className="text-title-large"
                    >
                      {task === 'components'
                        ? 'Create widget'
                        : task === 'history'
                          ? 'Revision history'
                          : 'Writing details'}
                    </h2>
                    <button className={control} onClick={returnToWriting}>
                      Back to writing
                    </button>
                  </div>
                  {task === 'details' && (
                    <div className="studio-task-form">
                      <label>
                        Format
                        <select
                          value={body.postType}
                          onChange={(event) =>
                            update({
                              ...bodyRef.current,
                              postType: event.target
                                .value as DraftContent['postType'],
                            })
                          }
                        >
                          <option value="article">Article</option>
                          <option value="note">Note</option>
                        </select>
                      </label>
                      <p className="text-body-medium text-muted">
                        Articles open with a title and description. Notes begin
                        with the writing itself.
                      </p>
                      {body.postType === 'note' && (
                        <label>
                          Private title
                          <input
                            value={body.title}
                            onChange={(event) =>
                              update({
                                ...bodyRef.current,
                                title: event.target.value,
                              })
                            }
                          />
                        </label>
                      )}
                      <p className="text-body-medium break-words text-muted">
                        Public address: /writings/{draft.slug}
                      </p>
                    </div>
                  )}
                  {task === 'history' && (
                    <>
                      <p className="text-body-medium text-muted">
                        Every save keeps the previous version. Restoring one
                        creates a new draft.
                      </p>
                      {historyLoading && (
                        <p role="status">Loading revisions…</p>
                      )}
                      {!historyLoading && revisions.length === 0 && (
                        <p>No earlier revisions yet.</p>
                      )}
                      {revisions.map((revision) => (
                        <div key={revision.id} className="studio-revision">
                          <details className="studio-history-inspection">
                            <summary>
                              Revision {revision.number} ·{' '}
                              {formatDate(revision.createdAt)}
                            </summary>
                            {revision.body.title && (
                              <h3 className="mt-4 text-title-medium">
                                {revision.body.title}
                              </h3>
                            )}
                            {revision.body.description && (
                              <p className="mt-2 text-body-medium text-muted">
                                {revision.body.description}
                              </p>
                            )}
                            <p className="mt-4 whitespace-pre-wrap text-body-medium">
                              {proseText(revision.body.document)}
                            </p>
                            {revision.body.originalSource && (
                              <p className="mt-2 text-body-small text-muted">
                                Imported source is retained in this revision.
                              </p>
                            )}
                          </details>
                          <button
                            className={control}
                            onClick={() => {
                              editor?.commands.setContent(
                                revision.body.document
                              );
                              update(revision.body);
                              returnToWriting();
                            }}
                          >
                            Restore as draft
                          </button>
                        </div>
                      ))}
                    </>
                  )}
                </section>
              )}
              <div hidden={task !== 'components'} className="studio-task-form">
                <StudioWidgetGenerator
                  documentId={draft.id}
                  revisionId={draft.head.id}
                  save={save}
                  onApproved={async (proposal) => {
                    const result = await studioRequest<{
                      entries: CatalogEntry[];
                    }>('/catalog');
                    catalogRef.current = result.entries;
                    setCatalog(result.entries);
                    const entry = result.entries.find(
                      (item) =>
                        item.id === proposal.id &&
                        item.version === proposal.version
                    );
                    if (entry) insert(entry);
                  }}
                />
              </div>
              {task === 'write' && (
                <>
                  {selection && (
                    <div
                      ref={selectionTools}
                      hidden={!selectionPosition}
                      style={selectionPosition || undefined}
                      className="studio-selection-tools site-glass"
                      role="toolbar"
                      aria-label="Selection tools"
                    >
                      <Popover
                        label="Format selected text"
                        trigger="Format"
                        triggerClassName={control}
                        panelClassName="studio-format-menu"
                        width={280}
                      >
                        {(['bold', 'italic'] as const).map((mark) => (
                          <button
                            key={mark}
                            aria-pressed={editor?.isActive(mark) || false}
                            onClick={() =>
                              editor?.chain().focus().toggleMark(mark).run()
                            }
                          >
                            {mark === 'bold' ? 'Bold' : 'Italic'}
                          </button>
                        ))}
                        <button
                          onClick={(event) => {
                            closePopover(event);
                            rememberRange();
                            setMedia('link');
                          }}
                        >
                          Link
                        </button>
                      </Popover>
                    </div>
                  )}
                  <div
                    data-empty={editor?.isEmpty ? 'true' : 'false'}
                    className="studio-writing-space"
                    onPointerDown={(event) => {
                      if (event.target !== event.currentTarget || !editor)
                        return;
                      event.preventDefault();
                      editor.commands.setTextSelection(
                        Math.max(1, editor.state.doc.content.size - 1)
                      );
                      editor.view.focus();
                      editor.commands.scrollIntoView();
                    }}
                  >
                    <EditorContent editor={editor} />
                  </div>
                  {media && (
                    <form
                      className="studio-task studio-task-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (media === 'image') void upload();
                        else if (/^(https?:\/\/|\/|#|mailto:)/i.test(url)) {
                          editor
                            ?.chain()
                            .focus()
                            .setTextSelection({
                              from: taskRange.current.from,
                              to: taskRange.current.to,
                            })
                            .setLink({ href: url })
                            .run();
                          setMedia(null);
                          setUrl('');
                        }
                      }}
                    >
                      <h2 className="text-title-large">
                        {media === 'image'
                          ? 'Add an image'
                          : 'Link selected text'}
                      </h2>
                      {media === 'image' ? (
                        <>
                          <label>
                            Image file
                            <input
                              type="file"
                              accept="image/*"
                              required
                              onChange={(event) =>
                                setImageFile(event.target.files?.[0] || null)
                              }
                            />
                          </label>
                          <label>
                            Image description
                            <textarea
                              autoFocus
                              value={alt}
                              required
                              onChange={(event) => setAlt(event.target.value)}
                              placeholder="What does this image add to the writing?"
                            />
                          </label>
                        </>
                      ) : (
                        <label>
                          Link address
                          <input
                            autoFocus
                            required
                            value={url}
                            onChange={(event) => setUrl(event.target.value)}
                            placeholder="https://"
                          />
                        </label>
                      )}
                      <button className={control} type="submit">
                        {media === 'image' ? 'Insert image' : 'Add link'}
                      </button>
                      <button
                        className={control}
                        type="button"
                        onClick={() => {
                          setMedia(null);
                          returnToWriting();
                        }}
                      >
                        Cancel
                      </button>
                    </form>
                  )}
                  <div className="studio-tags mt-4">
                    <Popover
                      label="Edit tags"
                      trigger={
                        body.tags.filter(Boolean).length
                          ? body.tags.filter(Boolean).map((tag) => (
                              <span
                                key={tag}
                                className="inline-block rounded-full border border-line bg-ground px-3 py-1 text-label-medium text-ink"
                              >
                                {tag}
                              </span>
                            ))
                          : 'Add tags'
                      }
                      triggerClassName="studio-tag-trigger"
                      panelClassName="studio-task-form"
                      width={300}
                    >
                      <label>
                        Tags
                        <input
                          value={body.tags.join(', ')}
                          onChange={(event) =>
                            update({
                              ...bodyRef.current,
                              tags: event.target.value
                                .split(',')
                                .map((tag) => tag.trim()),
                            })
                          }
                          placeholder="Ideas, places, projects"
                        />
                      </label>
                      <p className="text-body-small text-muted">
                        Separate tags with commas.
                      </p>
                    </Popover>
                  </div>
                </>
              )}
            </>
          ) : (
            <section className="studio-review-screen pt-10">
              <p
                role="status"
                aria-live="polite"
                className="text-label-large text-muted mb-4"
              >
                {status}
              </p>
              <div className="studio-task-heading">
                <h1
                  ref={reviewHeading}
                  tabIndex={-1}
                  className="text-headline-medium"
                >
                  {review ? 'Review publication' : 'Read your writing'}
                </h1>
                <button className={control} onClick={returnToWriting}>
                  Back to writing
                </button>
              </div>
              <p className="mt-4 text-body-large text-muted">
                {review
                  ? `This revision will appear at /writings/${draft.slug}. Website and portable versions are available below.`
                  : 'A preview of the current draft.'}
              </p>
              {review && (
                <p className="mt-3 text-label-large text-muted">
                  Saved revision {reviewedRevision}
                </p>
              )}
              <nav className="studio-preview-tabs" aria-label="Writing view">
                {(['read', 'portable'] as const).map((item) => (
                  <button
                    className={control}
                    key={item}
                    aria-pressed={mode === item}
                    onClick={() => setMode(item)}
                  >
                    {item === 'read' ? 'Read' : 'Portable preview'}
                  </button>
                ))}
              </nav>
              {preview && (
                <>
                  {mode === 'read' ? (
                    <article>
                      <header className="pb-10 pt-4">
                        {body.postType === 'article' && (
                          <div className="space-y-2">
                            <h2 className="text-headline-medium desktop:text-headline-large">
                              {body.title}
                            </h2>
                            <p className="text-body-large text-accent">
                              {body.description}
                            </p>
                          </div>
                        )}
                        <p className="mt-5 text-label-large text-muted">
                          <time dateTime={published}>
                            {formatDate(published)}
                          </time>
                          {body.postType === 'article' && (
                            <> · {minutes} min read</>
                          )}
                        </p>
                      </header>
                      <div
                        className={`prose prose-theme max-w-none ${body.postType === 'note' ? 'prose-xl [&_p]:text-body-large' : 'prose-lg [&_p]:text-body-medium'} [&_p]:my-4 [&_p]:leading-relaxed [&_p]:text-on-surface`}
                        dangerouslySetInnerHTML={{
                          __html: preview.contentHtml,
                        }}
                      />
                      {body.tags.filter(Boolean).length > 0 && (
                        <ul
                          className="mt-4 flex flex-wrap gap-2"
                          aria-label="Tags"
                        >
                          {body.tags.filter(Boolean).map((tag) => (
                            <li key={tag}>
                              <span className="inline-block rounded-full border border-line bg-ground px-3 py-1 text-label-medium text-ink">
                                {tag}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ) : (
                    <StudioPreview
                      title="Portable writing preview"
                      html={preview.portableHtml}
                    />
                  )}
                  {mode === 'portable' && (
                    <details className="mt-4">
                      <summary>Plain text version</summary>
                      <pre>{preview.portableText}</pre>
                    </details>
                  )}
                </>
              )}
              {review && preview && (
                <section className="studio-review mt-8">
                  <h2 className="text-title-large">Publication checks</h2>
                  {preview.issues.length ? (
                    <>
                      <p>Resolve these issues first:</p>
                      <ul>
                        {preview.issues.map((issue, index) => (
                          <li key={index}>
                            {typeof issue === 'string'
                              ? issue
                              : JSON.stringify(issue)}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : (
                    <p>No preview validation issues.</p>
                  )}
                  <button
                    className={control}
                    disabled={busy || preview.issues.length > 0 || conflict}
                    onClick={publish}
                  >
                    Publish this revision
                  </button>
                </section>
              )}
            </section>
          )}
          {publication && (
            <section className="studio-notice" role="status">
              <h2 className="text-title-large">
                {publication.status === 'live'
                  ? 'Your writing is live'
                  : publication.status === 'failed'
                    ? 'Publication needs attention'
                    : publication.status === 'deploying'
                      ? 'Deploying your writing…'
                      : 'Publishing your revision…'}
              </h2>
              <p>
                {publication.error ||
                  (publication.status === 'live'
                    ? 'The published revision is available on your site.'
                    : 'You can keep writing while this revision publishes.')}
              </p>
              {publication.pullRequestUrl && publication.status !== 'live' && (
                <SiteLink href={publication.pullRequestUrl}>
                  View publication checks
                </SiteLink>
              )}
              {publication.status === 'failed' && (
                <button
                  className={control}
                  disabled={busy}
                  onClick={() => void generatePreview('read', true)}
                >
                  Review and retry publication
                </button>
              )}
              {publication.status === 'live' && (
                <SiteLink href={`${site.origin}/writings/${draft.slug}`}>
                  Read published writing →
                </SiteLink>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
