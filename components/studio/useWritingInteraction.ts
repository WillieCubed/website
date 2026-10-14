'use client';

import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useRef } from 'react';

import type { Revision } from '@/lib/studio/types';

import {
  ActiveWritingBlock,
  type CatalogEntry,
  MdxSource,
  makeCatalogBlock,
} from './StudioNodes';
import { studioRequest } from './api';
import type { WritingState } from './useWritingState';
import type { WritingTask } from './writing-task-definitions';

/** Keep one Tiptap instance and its selection, insertion geometry, and task return anchor. */
export function useWritingInteraction(
  state: WritingState,
  onReady: () => void,
  interactive: boolean
) {
  const {
    draft,
    catalogRef,
    task,
    setTask,
    media,
    setMedia,
    mediaPanel,
    setMediaHeight,
    alt,
    setAlt,
    setUploading,
    uploadInFlight,
    imageFile,
    setImageFile,
    cursor,
    writingSpace,
    activePosition,
    setActivePosition,
    setInsertionPosition,
    insertAnchor,
    taskRange,
    taskHeading,
    selectionTools,
    setSelectionPosition,
    setHistoryLoading,
    reviewHeading,
    setAnnouncement,
    body,
    selection,
    setSelection,
    bodyRef,
    status,
    setStatus,
    mode,
    setMode,
    setReview,
    setRevisions,
    update,
  } = state;
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image,
      TableKit,
      Markdown,
      MdxSource,
      ActiveWritingBlock,
      makeCatalogBlock(() => catalogRef.current),
    ],
    // Activity may recreate Tiptap when returning to a cached route.
    content: bodyRef.current.document,
    editorProps: {
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === '/') {
          event.preventDefault();
          insertAnchor.current = _view.coordsAtPos(_view.state.selection.from);
          _view.dom
            .closest('.studio-writing-space')
            ?.querySelector<HTMLButtonElement>('[aria-label="Insert block"]')
            ?.click();
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
      setActivePosition(from);
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
    if (editor?.view.dom.isConnected) onReady();
  }, [editor, onReady]);
  useEffect(() => {
    if (
      !editor ||
      !interactive ||
      new URLSearchParams(window.location.search).get('compose') !== '1'
    )
      return;
    // Consume the entry intent, so reopening or reloading does not summon a keyboard.
    const address = new URL(window.location.href);
    address.searchParams.delete('compose');
    window.history.replaceState(window.history.state, '', address);
    editor.commands.focus('end', { scrollIntoView: false });
  }, [editor, interactive]);
  useEffect(() => {
    if (!editor || task !== 'write' || mode !== 'write') return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const block = editor.view.dom.querySelector('.studio-active-block');
        const space = writingSpace.current;
        if (!block || !space) return;
        const bounds = block.getBoundingClientRect();
        const origin = space.getBoundingClientRect();
        setInsertionPosition({
          top: bounds.top - origin.top,
          bottom: bounds.bottom - origin.top + 8,
          boundary: bounds.bottom - origin.top + 4,
        });
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(editor.view.dom);
    const activeBlock = editor.view.dom.querySelector('.studio-active-block');
    if (activeBlock) observer.observe(activeBlock);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [editor, activePosition, body.document, task, mode]);
  useEffect(() => {
    const panel = mediaPanel.current;
    if (!media || !panel) return;
    const observer = new ResizeObserver(() =>
      setMediaHeight(panel.getBoundingClientRect().height)
    );
    observer.observe(panel);
    setMediaHeight(panel.getBoundingClientRect().height);
    return () => observer.disconnect();
  }, [media]);
  useEffect(() => {
    let frame = 0;
    const release = () => {
      cancelAnimationFrame(frame);
      // Let the click finish before the focused block changes its geometry.
      frame = requestAnimationFrame(() => {
        const space = writingSpace.current;
        if (!space) return;
        space.removeAttribute('data-focus-press');
        const reduced = window.matchMedia(
          '(prefers-reduced-motion: reduce)'
        ).matches;
        // Release transitions held during pointer selection without moving its target.
        for (const animation of space.getAnimations({ subtree: true })) {
          const effect = animation.effect;
          if (!effect || (effect.getTiming().delay ?? 0) < 86_400_000) continue;
          effect.updateTiming({ delay: 0, duration: reduced ? 0 : 200 });
          animation.currentTime = 0;
        }
      });
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, []);
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
        // Keep selection controls local to the canvas. The first paragraph's
        // toolbar must not cover the document's Details/Preview/action buttons.
        const canvasTop =
          writingSpace.current?.getBoundingClientRect().top ?? 0;
        const above = start.top - height - 8;
        setSelectionPosition({
          left: Math.max(16, Math.min(start.left, innerWidth - width - 16)),
          top:
            above >= Math.max(16, canvasTop)
              ? above
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
  function rememberRange() {
    if (editor)
      taskRange.current = {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
        scroll: window.scrollY,
      };
  }
  function openTask(next: Exclude<WritingTask, 'write'>) {
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
    // The canvas stays mounted for editor continuity; its portal settings must
    // retire when a different writing task takes over.
    window.dispatchEvent(
      new CustomEvent('studio:widget-settings', { detail: '' })
    );
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
    if (interactive && task !== 'write') taskHeading.current?.focus();
  }, [task, interactive]);
  async function upload() {
    if (!imageFile || !editor || !alt.trim() || uploadInFlight.current) return;
    uploadInFlight.current = true;
    setUploading(true);
    let insertion = editor.state.selection.getBookmark();
    const trackInsertion = ({
      transaction,
    }: {
      transaction: import('@tiptap/pm/state').Transaction;
    }) => {
      insertion = insertion.map(transaction.mapping);
    };
    editor.on('transaction', trackInsertion);
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
        .setTextSelection(insertion.resolve(editor.state.doc).from)
        .insertContent({
          type: 'catalogBlock',
          attrs: {
            id: 'figure',
            version: '1',
            props: { src: asset.url, alt, caption: '', size: 'default' },
            instance: crypto.randomUUID(),
          },
        })
        .run();
      setMedia(null);
      setAlt('');
      setImageFile(null);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      editor.off('transaction', trackInsertion);
      uploadInFlight.current = false;
      setUploading(false);
    }
  }
  function insert(entry: CatalogEntry) {
    if (!editor) return;
    const at = editor.state.doc.resolve(
      Math.min(cursor.current, editor.state.doc.content.size)
    );
    const boundary = at.depth ? at.after(1) : at.pos;
    editor.commands.insertContentAt(boundary, {
      type: 'catalogBlock',
      attrs: {
        id: entry.id,
        version: entry.version,
        props: entry.example,
        children: ['callout', 'reference'].includes(entry.id) ? '' : null,
        instance: crypto.randomUUID(),
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

  return {
    editor,
    rememberRange,
    openTask,
    returnToWriting,
    upload,
    insert,
    closePopover,
    history,
  };
}
