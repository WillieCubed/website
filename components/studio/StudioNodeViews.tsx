'use client';

import { type NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import Icon from '@/components/icons/Icon';
import Button from '@/components/site/Button';

import type { CatalogEntry } from '@/lib/studio/catalog';
import { portableReview, portableReviewed } from '@/lib/studio/portable';

import BlockPreview from './BlockPreview';
import CatalogFields from './CatalogFields';
import WidgetInspector from './WidgetInspector';

export const StudioCatalogContext = createContext<CatalogEntry[] | null>(null);
interface CatalogLoadStatus {
  message: string;
  retry?: () => void;
}
export const StudioCatalogStatusContext = createContext<CatalogLoadStatus>({
  message: '',
});
export function SourceView({
  node,
  updateAttributes,
  deleteNode,
}: NodeViewProps) {
  return (
    <NodeViewWrapper className="studio-source" contentEditable={false}>
      <div className="studio-block-heading">
        <strong>Imported MDX</strong>
        <Button onClick={deleteNode} aria-label="Remove imported MDX">
          Remove
        </Button>
      </div>
      <p>
        This block keeps its original source. Edit it here, or leave it intact.
      </p>
      <textarea
        aria-label="MDX source"
        value={String(node.attrs.source)}
        onChange={(event) => updateAttributes({ source: event.target.value })}
        spellCheck={false}
      />
    </NodeViewWrapper>
  );
}
type WidgetAttributes = Record<string, unknown>;
interface WidgetSettingsProps {
  attrs: WidgetAttributes;
  fieldsId: string;
  updateAttributes: (attributes: WidgetAttributes) => void;
}
interface WidgetFieldsProps extends WidgetSettingsProps {
  entry?: CatalogEntry;
  catalogStatus: CatalogLoadStatus;
}

function WidgetFields({
  entry,
  catalogStatus,
  attrs,
  fieldsId,
  updateAttributes,
}: WidgetFieldsProps) {
  return (
    <div className="studio-widget-settings">
      {!entry && (
        <div className="site-field">
          <p role="status">
            {catalogStatus.message || 'Widget settings are unavailable.'}
          </p>
          {catalogStatus.retry && (
            <Button
              onClick={() => {
                document
                  .getElementById(fieldsId)
                  ?.querySelector('h2')
                  ?.focus({ preventScroll: true });
                catalogStatus.retry?.();
              }}
            >
              Retry widget settings
            </Button>
          )}
        </div>
      )}
      {entry && (
        <CatalogFields
          entry={entry}
          props={attrs.props as Record<string, unknown>}
          fieldsId={fieldsId}
          onChange={updateAttributes}
        />
      )}
      {['callout', 'reference'].includes(String(attrs.id)) &&
        attrs.children !== null && (
          <label className="site-field">
            Content
            <textarea
              value={String(attrs.children || '')}
              onChange={(event) =>
                updateAttributes({ children: event.target.value })
              }
            />
          </label>
        )}
    </div>
  );
}

interface PortableSettingsProps extends WidgetSettingsProps {
  reviewed: boolean;
}

function PortableSettings({
  attrs,
  fieldsId,
  reviewed,
  updateAttributes,
}: PortableSettingsProps) {
  return (
    <details className="studio-portable-settings">
      <summary className="site-control studio-disclosure">
        <span id={`${fieldsId}-portable-label`}>Feed alternative</span>
        <span className="studio-alternative-status" role="status">
          {reviewed ? 'Reviewed' : 'Needs review'}
        </span>
      </summary>
      <section aria-labelledby={`${fieldsId}-portable-label`}>
        <div className="site-field">
          <textarea
            id={`${fieldsId}-portable`}
            aria-labelledby={`${fieldsId}-portable-label`}
            placeholder="Describe what this widget shows."
            value={String(attrs.portable ?? '')}
            rows={5}
            onChange={(event) =>
              updateAttributes({ portable: event.target.value })
            }
          />
        </div>
        <Button
          disabled={!String(attrs.portable ?? '').trim() || reviewed}
          onClick={() =>
            updateAttributes({
              portableReview: portableReview(attrs),
            })
          }
        >
          Confirm alternative
        </Button>
      </section>
    </details>
  );
}

interface RetainedWidgetTextProps {
  attrs: WidgetAttributes;
}

function RetainedWidgetText({ attrs }: RetainedWidgetTextProps) {
  return (
    !['callout', 'reference'].includes(String(attrs.id)) &&
    String(attrs.children || '').trim() && (
      <details className="studio-block-details">
        <summary className="site-control studio-disclosure">
          Previously saved text
        </summary>
        <p>
          This widget does not display this text. It is preserved here so you
          can copy it into your writing.
        </p>
        <textarea
          aria-label="Previously saved widget text"
          readOnly
          value={String(attrs.children)}
        />
      </details>
    )
  );
}

function catalogBlockEntry(
  catalog: CatalogEntry[] | null,
  entries: CatalogEntry[] | (() => CatalogEntry[]),
  attrs: WidgetAttributes
): CatalogEntry | undefined {
  return (
    catalog ?? (typeof entries === 'function' ? entries() : entries)
  ).find((item) => item.id === attrs.id && item.version === attrs.version);
}
function catalogBlockName(
  entry: CatalogEntry | undefined,
  generated: boolean,
  id: unknown
): string {
  return (entry?.name || (generated ? 'Widget' : String(id)))
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');
}

interface WidgetReviewGuidanceProps {
  generated: boolean;
  editing: boolean;
  reviewed: boolean;
}

function WidgetReviewGuidance({
  generated,
  editing,
  reviewed,
}: WidgetReviewGuidanceProps) {
  if (!generated || editing || reviewed) return null;
  return (
    <p className="studio-block-guidance" role="status">
      Static alternative needs review. Choose Edit block to review it.
    </p>
  );
}

interface CatalogViewProps extends NodeViewProps {
  entries: CatalogEntry[] | (() => CatalogEntry[]);
}

export function CatalogView({
  node,
  updateAttributes,
  deleteNode,
  editor,
  getPos,
  entries,
}: CatalogViewProps) {
  const catalog = useContext(StudioCatalogContext);
  const catalogStatus = useContext(StudioCatalogStatusContext);
  const entry = catalogBlockEntry(catalog, entries, node.attrs);
  const generated = ![
    'figure',
    'callout',
    'reference',
    'youtube',
    'spotify',
    'soundcloud',
  ].includes(String(node.attrs.id));
  const reviewed = portableReviewed(node.attrs);
  const [editing, setEditing] = useState(false);
  const fieldsId = useId();
  const editButton = useRef<HTMLButtonElement>(null);
  const name = catalogBlockName(entry, generated, node.attrs.id);
  useEffect(() => {
    const change = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== fieldsId) setEditing(false);
    };
    window.addEventListener('studio:widget-settings', change);
    return () => window.removeEventListener('studio:widget-settings', change);
  }, [fieldsId]);
  function beginEditing() {
    window.dispatchEvent(
      new CustomEvent('studio:widget-settings', { detail: fieldsId })
    );
    setEditing(true);
  }
  function finishEditing() {
    // Retain the focused block's shape across the handoff; an unfocused
    // frame would collapse it and move the browser's reading anchor.
    editButton.current?.focus({ preventScroll: true });
    setEditing(false);
  }
  return (
    <NodeViewWrapper
      className="studio-catalog-block"
      data-block-type={String(node.attrs.id)}
      onFocusCapture={() => {
        const position = getPos();
        if (
          typeof position === 'number' &&
          editor.state.selection.from !== position
        )
          editor.commands.setNodeSelection(position);
      }}
      data-editing={editing || undefined}
      contentEditable={false}
    >
      <div className="studio-block-heading studio-widget-toolbar">
        <span className="studio-widget-type" aria-hidden={editing || undefined}>
          {name}
        </span>
        <Button
          ref={editButton}
          variant={editing ? 'tonal' : 'surface'}
          aria-expanded={editing}
          aria-controls={fieldsId}
          aria-haspopup="dialog"
          onClick={() =>
            editing
              ? document
                  .getElementById(fieldsId)
                  ?.querySelector<HTMLElement>('h2')
                  ?.focus()
              : beginEditing()
          }
        >
          <Icon name="pen-line" /> <span>Edit block</span>
        </Button>
      </div>
      <div
        className="studio-widget-output"
        role="group"
        aria-label={`${entry?.name || 'Block'} preview`}
      >
        <BlockPreview attrs={node.attrs} />
      </div>
      <WidgetReviewGuidance
        generated={generated}
        editing={editing}
        reviewed={reviewed}
      />
      <RetainedWidgetText attrs={node.attrs} />
      {editing && (
        <WidgetInspector
          id={fieldsId}
          name={name}
          onDismiss={finishEditing}
          onRemove={() => {
            setEditing(false);
            deleteNode();
            editor.commands.focus();
          }}
        >
          <WidgetFields
            entry={entry}
            catalogStatus={catalogStatus}
            attrs={node.attrs}
            fieldsId={fieldsId}
            updateAttributes={updateAttributes}
          />
          {generated && (
            <PortableSettings
              attrs={node.attrs}
              fieldsId={fieldsId}
              reviewed={reviewed}
              updateAttributes={updateAttributes}
            />
          )}
        </WidgetInspector>
      )}
    </NodeViewWrapper>
  );
}
