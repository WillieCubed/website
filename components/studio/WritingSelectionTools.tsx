'use client';
import type { Editor } from '@tiptap/react';
import { type RefObject, useEffect, useRef, useState } from 'react';

import Button from '@/components/site/Button';

import type { WritingTextSelection } from './writing-contracts';

interface WritingSelectionToolsProps {
  visible: boolean;
  selection: WritingTextSelection | null;
  editor: Editor | null;
  canvas: RefObject<HTMLDivElement | null>;
  onLink: () => void;
}

interface ToolbarPosition {
  top: number;
  left: number;
}
interface ToolbarSize {
  width: number;
  height: number;
}

export default function WritingSelectionTools({
  visible,
  selection,
  editor,
  canvas,
  onLink,
}: WritingSelectionToolsProps) {
  const selectionTools = useRef<HTMLDivElement>(null);
  const [selectionPosition, setSelectionPosition] =
    useState<ToolbarPosition | null>(null);
  useEffect(() => {
    if (editor === null || selection === null || !visible) {
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
        const { width, height } = selectionToolbarSize(selectionTools.current);
        // Keep selection controls local to the canvas. The first paragraph's
        // toolbar must not cover the document's Details/Preview/action buttons.
        const canvasTop = canvas.current?.getBoundingClientRect().top ?? 0;
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
  }, [editor, selection, visible]);
  return (
    selection !== null && (
      <div
        ref={selectionTools}
        hidden={!visible || selectionPosition === null}
        style={selectionPosition ?? undefined}
        className="studio-selection-tools site-glass"
        role="toolbar"
        aria-label="Selection tools"
      >
        {(['bold', 'italic'] as const).map((mark) => (
          <Button
            key={mark}
            aria-pressed={editor?.isActive(mark) || false}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() =>
              editor
                ?.chain()
                .focus()
                .setTextSelection({
                  from: selection.from,
                  to: selection.to,
                })
                .toggleMark(mark)
                .run()
            }
          >
            {mark === 'bold' ? <strong>Bold</strong> : <em>Italic</em>}
          </Button>
        ))}
        <Button
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            onLink();
          }}
        >
          Link
        </Button>
      </div>
    )
  );
}

function selectionToolbarSize(element: HTMLElement | null): ToolbarSize {
  return {
    width: element?.offsetWidth || 300,
    height: element?.offsetHeight || 60,
  };
}
