'use client';
import type { Editor } from '@tiptap/react';
import { EditorContent } from '@tiptap/react';
import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { EditorNode } from '@/lib/studio/types';

import type { CatalogEntry } from './StudioNodes';
import { StudioWritingSurface } from './StudioWritingLayout';
import WritingInsertionMenu from './WritingInsertionMenu';
import { WritingImageForm, WritingLinkForm } from './WritingMediaForms';
import WritingSelectionTools from './WritingSelectionTools';
import type {
  WritingInsertionBounds,
  WritingReturnPoint,
  WritingTextSelection,
} from './writing-contracts';
import type { WritingTask } from './writing-task-definitions';

interface WritingCanvasProps {
  visible: boolean;

  catalog: CatalogEntry[];
  cursor: RefObject<number>;
  insertAnchor: RefObject<WritingInsertionBounds | null>;
  insertionRect: () => WritingInsertionBounds | null;
  taskRange: RefObject<WritingReturnPoint>;
  selection: WritingTextSelection | null;
  editor: Editor | null;
  rememberRange: () => void;
  openTask: (task: Exclude<WritingTask, 'write'>) => void;
  returnToWriting: () => void;
  insert: (entry: CatalogEntry) => void;
  control: string;
  setStatus: (status: string) => void;
}

export default function WritingCanvas({
  catalog,
  cursor,
  insertAnchor,
  insertionRect,
  taskRange,
  selection,
  editor,
  rememberRange,
  openTask,
  returnToWriting,
  insert,
  control,
  setStatus,
  visible,
}: WritingCanvasProps) {
  // This owner stays mounted through tasks and previews; child media drafts do too.
  const [media, setMedia] = useState<'link' | 'image' | null>(null);
  const [mediaHeight, setMediaHeight] = useState(0);
  const writingSpace = useRef<HTMLDivElement>(null);
  const [insertionPosition, setInsertionPosition] = useState({
    top: 0,
    bottom: 0,
    boundary: 0,
  });
  useEffect(() => {
    if (editor === null || !visible) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const block = editor.view.dom.querySelector('.studio-active-block');
        const space = writingSpace.current;
        if (block === null || space === null) return;
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
    editor.on('transaction', measure);
    const observer = new ResizeObserver(measure);
    observer.observe(editor.view.dom);
    const activeBlock = editor.view.dom.querySelector('.studio-active-block');
    if (activeBlock) observer.observe(activeBlock);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      editor.off('transaction', measure);
      window.removeEventListener('resize', measure);
    };
  }, [editor, selection, visible]);
  useEffect(() => {
    let frame = 0;
    const release = () => {
      cancelAnimationFrame(frame);
      // Let the click finish before the focused block changes its geometry.
      frame = requestAnimationFrame(() => {
        const space = writingSpace.current;
        if (space === null) return;
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
  function openMedia(kind: 'link' | 'image') {
    rememberRange();
    setMedia(kind);
  }
  function closeMedia() {
    setMedia(null);
    setMediaHeight(0);
  }
  function cancelMedia() {
    closeMedia();
    returnToWriting();
  }
  function insertBlock(node: EditorNode) {
    if (editor === null) return;
    const at = editor.state.doc.resolve(
      Math.min(cursor.current, editor.state.doc.content.size)
    );
    editor
      .chain()
      .focus()
      .insertContentAt(at.depth > 0 ? at.after(1) : at.pos, node)
      .run();
  }
  return (
    <>
      <WritingSelectionTools
        visible={visible}
        selection={selection}
        editor={editor}
        canvas={writingSpace}
        onLink={() => openMedia('link')}
      />
      <StudioWritingSurface
        hidden={!visible}
        ref={writingSpace}
        style={
          {
            '--inline-panel-height': `${mediaHeight}px`,
          } as React.CSSProperties
        }
        data-empty={editor?.isEmpty ? 'true' : 'false'}
        className="studio-writing-space"
        onPointerDownCapture={(event) => {
          event.currentTarget.setAttribute('data-focus-press', '');
        }}
        onPointerDown={(event) => {
          const target = event.target as HTMLElement;
          if (
            editor === null ||
            (target !== event.currentTarget &&
              !target.classList.contains('studio-writing-surface') &&
              !target.classList.contains('studio-region-label'))
          )
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
        <div
          className="studio-insertion-row"
          style={
            {
              '--block-top': `${insertionPosition.top}px`,
              '--block-bottom': `${insertionPosition.bottom}px`,
              '--block-boundary': `${insertionPosition.boundary}px`,
            } as React.CSSProperties
          }
          onKeyDownCapture={(event) => {
            if (event.key === 'Escape') {
              insertAnchor.current = null;
              requestAnimationFrame(() =>
                editor?.commands.focus(null, {
                  scrollIntoView: false,
                })
              );
            }
          }}
          onPointerDownCapture={(event) => {
            event.stopPropagation();
            insertAnchor.current = null;
          }}
        >
          <WritingInsertionMenu
            catalog={catalog}
            anchorRect={insertionRect}
            control={control}
            onInsertBlock={insertBlock}
            onInsertWidget={insert}
            onImage={() => openMedia('image')}
            onCreateWidget={() => openTask('components')}
          />
        </div>
        {media === 'image' && (
          <WritingImageForm
            editor={editor}
            visible={visible}
            top={insertionPosition.bottom}
            onClose={closeMedia}
            onCancel={cancelMedia}
            onStatus={setStatus}
            onHeightChange={setMediaHeight}
          />
        )}
        {media === 'link' && (
          <WritingLinkForm
            editor={editor}
            range={taskRange}
            top={insertionPosition.bottom}
            onClose={closeMedia}
            onCancel={cancelMedia}
            onHeightChange={setMediaHeight}
          />
        )}
      </StudioWritingSurface>
    </>
  );
}
