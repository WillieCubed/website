'use client';

import Image from '@tiptap/extension-image';
import { TableKit } from '@tiptap/extension-table';
import { Markdown } from '@tiptap/markdown';
import { type Editor, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { DraftContent } from '@/lib/studio/types';

import {
  ActiveWritingBlock,
  type CatalogEntry,
  MdxSource,
  makeCatalogBlock,
} from './StudioNodes';
import type {
  DraftEditing,
  WritingInsertionBounds,
  WritingMode,
  WritingPreviewMode,
  WritingReturnPoint,
  WritingTextSelection,
} from './writing-contracts';
import type { WritingPanelTask, WritingTask } from './writing-task-definitions';

export interface WritingInteraction {
  editor: Editor | null;
  mode: WritingMode;
  task: WritingTask;
  taskHeading: RefObject<HTMLHeadingElement | null>;
  cursor: RefObject<number>;
  insertAnchor: RefObject<WritingInsertionBounds | null>;
  insertionRect: () => WritingInsertionBounds | null;
  taskRange: RefObject<WritingReturnPoint>;
  selection: WritingTextSelection | null;
  rememberRange: () => void;
  openTask: (task: WritingPanelTask) => void;
  showPreview: (mode: WritingPreviewMode) => void;
  returnToWriting: () => void;
  replaceDocument: (body: DraftContent) => void;
  insert: (entry: CatalogEntry) => void;
  closePopover: (event: React.MouseEvent) => void;
}

/** Keep one editor, its catalog extensions, and the selection used when returning from tasks. */
export function useWritingInteraction(
  document: DraftEditing,
  readCatalog: () => CatalogEntry[],
  onReady: () => void,
  interactive: boolean
): WritingInteraction {
  const { body, update, captureSnapshot } = document;
  const cursor = useRef(1);
  const insertAnchor = useRef<WritingInsertionBounds | null>(null);
  const insertionRect = useCallback(() => insertAnchor.current, []);
  const [selection, setSelection] = useState<WritingTextSelection | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Image,
      TableKit,
      Markdown,
      MdxSource,
      ActiveWritingBlock,
      makeCatalogBlock(readCatalog),
    ],
    // Activity may recreate Tiptap when returning to a cached route.
    content: captureSnapshot().body.document,
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
      update((current) => ({ ...current, document: editor.getJSON() })),
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
  function replaceDocument(next: DraftContent) {
    editor?.commands.setContent(next.document, { emitUpdate: false });
    update(next);
  }
  const navigation = useWritingNavigation(editor, interactive);
  function insert(entry: CatalogEntry) {
    if (!editor) return;
    const at = editor.state.doc.resolve(
      Math.min(cursor.current, editor.state.doc.content.size)
    );
    const boundary = at.depth > 0 ? at.after(1) : at.pos;
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
    navigation.finishInsertion();
  }
  function closePopover(event: React.MouseEvent) {
    (
      event.currentTarget.closest('[popover]') as HTMLElement | null
    )?.hidePopover();
  }

  return {
    ...navigation,
    cursor,
    insertAnchor,
    insertionRect,
    selection,
    editor,
    replaceDocument,
    insert,
    closePopover,
  };
}

/** Task navigation retains the editor return point while task panels or previews have focus. */
function useWritingNavigation(editor: Editor | null, interactive: boolean) {
  const [mode, setMode] = useState<WritingMode>('write');
  const [task, setTask] = useState<WritingTask>('write');
  useEffect(() => {
    const address = new URL(window.location.href);
    if (address.searchParams.get('components') !== '1') return;
    setTask('components');
    address.searchParams.delete('components');
    window.history.replaceState(window.history.state, '', address);
  }, []);
  useEffect(() => {
    if (mode !== 'write')
      window.dispatchEvent(
        new CustomEvent('studio:widget-settings', { detail: '' })
      );
  }, [mode]);
  const taskRange = useRef<WritingReturnPoint>({ from: 1, to: 1, scroll: 0 });
  const taskHeading = useRef<HTMLHeadingElement>(null);
  function rememberRange() {
    if (editor)
      taskRange.current = {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
        scroll: window.scrollY,
      };
  }
  function openTask(next: WritingPanelTask) {
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
  function showPreview(nextMode: WritingPreviewMode) {
    setMode(nextMode);
  }
  useEffect(() => {
    if (interactive && task !== 'write') taskHeading.current?.focus();
  }, [task, interactive]);
  return {
    mode,
    task,
    taskRange,
    taskHeading,
    rememberRange,
    openTask,
    returnToWriting,
    showPreview,
    finishInsertion: () => setTask('write'),
  };
}
