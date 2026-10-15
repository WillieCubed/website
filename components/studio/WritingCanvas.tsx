'use client';
import type { Editor } from '@tiptap/react';
import { EditorContent } from '@tiptap/react';
import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

import Icon from '@/components/icons/Icon';
import Button from '@/components/site/Button';
import Popover from '@/components/site/Popover';

import type { EditorNode } from '@/lib/studio/types';

import type { CatalogEntry } from './StudioNodes';
import { StudioWritingSurface } from './StudioWritingLayout';
import { studioRequest } from './api';
import type { WritingTask } from './writing-task-definitions';

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
  closePopover,
  control,
  setStatus,
  visible,
}: {
  visible: boolean;

  catalog: CatalogEntry[];
  cursor: RefObject<number>;
  insertAnchor: RefObject<Pick<
    DOMRect,
    'left' | 'right' | 'top' | 'bottom'
  > | null>;
  insertionRect: () => Pick<
    DOMRect,
    'left' | 'right' | 'top' | 'bottom'
  > | null;
  taskRange: RefObject<{ from: number; to: number; scroll: number }>;
  selection: { from: number; to: number; text: string } | null;
  editor: Editor | null;
  rememberRange: () => void;
  openTask: (task: Exclude<WritingTask, 'write'>) => void;
  returnToWriting: () => void;
  insert: (entry: CatalogEntry) => void;
  closePopover: (event: React.MouseEvent) => void;
  control: string;
  setStatus: (status: string) => void;
}) {
  // Hidden tasks and previews retain this owner, including the native file input.
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const [media, setMedia] = useState<'link' | 'image' | null>(null);
  const mediaPanel = useRef<HTMLFormElement>(null);
  const [mediaHeight, setMediaHeight] = useState(0);
  const [url, setUrl] = useState('');
  const [alt, setAlt] = useState('');
  const [uploading, setUploading] = useState(false);
  const uploadInFlight = useRef(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const writingSpace = useRef<HTMLDivElement>(null);
  const [insertionPosition, setInsertionPosition] = useState({
    top: 0,
    bottom: 0,
    boundary: 0,
  });
  const selectionTools = useRef<HTMLDivElement>(null);
  const [selectionPosition, setSelectionPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  useEffect(() => {
    if (!editor || !visible) return;
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
  useEffect(() => {
    if (!editor || !selection || !visible) {
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
  }, [editor, selection, visible]);
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
      if (visibleRef.current) editor.commands.focus();
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

  return (
    <>
      <SelectionTools
        visible={visible}
        selection={selection}
        selectionTools={selectionTools}
        selectionPosition={selectionPosition}
        editor={editor}
        rememberRange={rememberRange}
        setMedia={setMedia}
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
            !editor ||
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
          <Popover
            anchorRect={insertionRect}
            label="Insert block"
            trigger={
              <>
                <Icon name="plus" />
                <span className="studio-add-label">Insert block</span>
              </>
            }
            triggerClassName={`${control} site-button-icon`}
            panelClassName="studio-action-menu"
            width={280}
          >
            {(
              [
                ['Heading', { type: 'heading', attrs: { level: 2 } }],
                [
                  'List',
                  {
                    type: 'bulletList',
                    content: [
                      {
                        type: 'listItem',
                        content: [{ type: 'paragraph' }],
                      },
                    ],
                  },
                ],
                [
                  'Quote',
                  {
                    type: 'blockquote',
                    content: [{ type: 'paragraph' }],
                  },
                ],
                ['Code', { type: 'codeBlock' }],
                [
                  'Table',
                  {
                    type: 'table',
                    content: Array.from({ length: 3 }, (_, row) => ({
                      type: 'tableRow',
                      content: Array.from({ length: 3 }, () => ({
                        type: row === 0 ? 'tableHeader' : 'tableCell',
                        content: [{ type: 'paragraph' }],
                      })),
                    })),
                  },
                ],
              ] satisfies [string, EditorNode][]
            ).map(([label, node]) => (
              <button
                key={label}
                onClick={(event) => {
                  closePopover(event);
                  if (!editor) return;
                  const at = editor.state.doc.resolve(
                    Math.min(cursor.current, editor.state.doc.content.size)
                  );
                  editor
                    .chain()
                    .focus()
                    .insertContentAt(at.depth ? at.after(1) : at.pos, node)
                    .run();
                }}
              >
                {label}
              </button>
            ))}
            <button
              onClick={(event) => {
                closePopover(event);
                rememberRange();
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
        {media && (
          <form
            ref={mediaPanel}
            aria-busy={uploading}
            className="studio-task studio-task-form studio-inline-media"
            style={{ top: insertionPosition.bottom }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                if (uploading) return;
                setMedia(null);
                returnToWriting();
              }
            }}
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
              {media === 'image' ? 'Add an image' : 'Link selected text'}
            </h2>
            {media === 'image' ? (
              <>
                <label className="site-field">
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
                <label className="site-field">
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
              <label className="site-field">
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
            <Button type="submit" disabled={uploading}>
              {uploading
                ? 'Uploading…'
                : media === 'image'
                  ? 'Insert image'
                  : 'Add link'}
            </Button>
            <Button
              type="button"
              disabled={uploading}
              onClick={() => {
                setMedia(null);
                returnToWriting();
              }}
            >
              Cancel
            </Button>
          </form>
        )}
      </StudioWritingSurface>
    </>
  );
}

function SelectionTools({
  visible,
  selection,
  selectionTools,
  selectionPosition,
  editor,
  rememberRange,
  setMedia,
}: {
  selection: { from: number; to: number; text: string } | null;
  selectionTools: RefObject<HTMLDivElement | null>;
  selectionPosition: { top: number; left: number } | null;
  editor: Editor | null;
  rememberRange: () => void;
  setMedia: (media: 'link' | 'image' | null) => void;
} & { visible: boolean }) {
  return (
    selection && (
      <div
        ref={selectionTools}
        hidden={!visible || !selectionPosition}
        style={selectionPosition || undefined}
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
            rememberRange();
            setMedia('link');
          }}
        >
          Link
        </Button>
      </div>
    )
  );
}

function selectionToolbarSize(element: HTMLElement | null): {
  width: number;
  height: number;
} {
  return {
    width: element?.offsetWidth || 300,
    height: element?.offsetHeight || 60,
  };
}
