'use client';

import { EditorContent } from '@tiptap/react';

import Icon from '@/components/icons/Icon';
import Button from '@/components/site/Button';
import Popover from '@/components/site/Popover';

import type { EditorNode } from '@/lib/studio/types';

import { StudioWritingSurface } from './StudioWritingLayout';
import type { WritingController } from './useWritingController';

export default function WritingCanvas({
  controller,
  visible,
}: {
  visible: boolean;
  controller: Pick<
    WritingController,
    | 'catalog'
    | 'media'
    | 'setMedia'
    | 'mediaPanel'
    | 'mediaHeight'
    | 'url'
    | 'setUrl'
    | 'alt'
    | 'setAlt'
    | 'uploading'
    | 'setImageFile'
    | 'cursor'
    | 'writingSpace'
    | 'insertionPosition'
    | 'insertAnchor'
    | 'insertionRect'
    | 'taskRange'
    | 'selectionTools'
    | 'selectionPosition'
    | 'selection'
    | 'editor'
    | 'rememberRange'
    | 'openTask'
    | 'returnToWriting'
    | 'upload'
    | 'insert'
    | 'closePopover'
    | 'control'
  >;
}) {
  const {
    catalog,
    media,
    setMedia,
    mediaPanel,
    mediaHeight,
    url,
    setUrl,
    alt,
    setAlt,
    uploading,
    setImageFile,
    cursor,
    writingSpace,
    insertionPosition,
    insertAnchor,
    insertionRect,
    taskRange,
    selectionTools,
    selectionPosition,
    selection,
    editor,
    rememberRange,
    openTask,
    returnToWriting,
    upload,
    insert,
    closePopover,
    control,
  } = controller;
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
}: Pick<
  WritingController,
  | 'selection'
  | 'selectionTools'
  | 'selectionPosition'
  | 'editor'
  | 'rememberRange'
  | 'setMedia'
> & { visible: boolean }) {
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
