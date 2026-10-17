import Icon from '@/components/icons/Icon';
import Popover from '@/components/site/Popover';

import type { EditorNode } from '@/lib/studio/types';

import type { CatalogEntry } from './StudioNodes';
import type { WritingInsertionBounds } from './writing-contracts';

interface WritingInsertionMenuProps {
  catalog: CatalogEntry[];
  anchorRect: () => WritingInsertionBounds | null;
  control: string;
  onInsertBlock: (node: EditorNode) => void;
  onInsertWidget: (entry: CatalogEntry) => void;
  onImage: () => void;
  onCreateWidget: () => void;
}

type WritingBlockOption = [label: string, node: EditorNode];

export default function WritingInsertionMenu({
  catalog,
  anchorRect,
  control,
  onInsertBlock,
  onInsertWidget,
  onImage,
  onCreateWidget,
}: WritingInsertionMenuProps) {
  function closePopover(event: React.MouseEvent) {
    (
      event.currentTarget.closest('[popover]') as HTMLElement | null
    )?.hidePopover();
  }
  return (
    <Popover
      anchorRect={anchorRect}
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
        ] satisfies WritingBlockOption[]
      ).map(([label, node]) => (
        <button
          key={label}
          onClick={(event) => {
            closePopover(event);
            onInsertBlock(node);
          }}
        >
          {label}
        </button>
      ))}
      <button
        onClick={(event) => {
          closePopover(event);
          onImage();
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
            onInsertWidget(entry);
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
          onCreateWidget();
        }}
      >
        Create widget…
      </button>
    </Popover>
  );
}
