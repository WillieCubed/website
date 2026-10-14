'use client';

import Icon from '@/components/icons/Icon';
import Button from '@/components/site/Button';
import Popover from '@/components/site/Popover';

import type { WritingController } from './useWritingController';

export default function WritingControls({
  controller,
}: {
  controller: Pick<
    WritingController,
    | 'conflict'
    | 'recovery'
    | 'busy'
    | 'editor'
    | 'openTask'
    | 'closePopover'
    | 'history'
    | 'save'
    | 'generatePreview'
    | 'control'
  >;
}) {
  const {
    conflict,
    recovery,
    busy,
    editor,
    openTask,
    closePopover,
    history,
    save,
    generatePreview,
    control,
  } = controller;
  return (
    <>
      <nav className="studio-document-controls" aria-label="Writing controls">
        <Button
          aria-label="Writing details"
          onClick={() => openTask('details')}
        >
          <Icon name="sliders" size={18} />
          <span>Details</span>
        </Button>
        <Button
          aria-label="Read preview"
          disabled={busy}
          onClick={() => void generatePreview('read')}
        >
          <Icon name="eye" size={18} />
          <span>Preview</span>
        </Button>
        <Popover
          label="Writing actions"
          trigger={<Icon name="more-horizontal" size={20} />}
          triggerClassName={control}
          panelClassName="studio-action-menu"
          align="end"
          width={260}
        >
          <button
            disabled={busy || conflict || !!recovery}
            onClick={(event) => {
              closePopover(event);
              void generatePreview('read', true);
            }}
          >
            Review publication
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
        </Popover>{' '}
      </nav>
    </>
  );
}
