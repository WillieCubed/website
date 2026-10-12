'use client';
import { Extension, Node } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react';
import { useEffect, useId, useRef, useState } from 'react';

import Icon from '@/components/icons/Icon';

import type { CatalogEntry } from '@/lib/studio/catalog';

import { studioRequest } from './api';

export type { CatalogEntry } from '@/lib/studio/catalog';
// Decorations are editor-only: the active block never changes the saved document.
export const ActiveWritingBlock = Extension.create({
  name: 'activeWritingBlock',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const { $from, from } = state.selection;
            // Follow the text block even inside a long list or quotation.
            const start = $from.depth ? $from.before($from.depth) : from;
            const node = state.doc.nodeAt(start);
            return node?.isBlock
              ? DecorationSet.create(state.doc, [
                  Decoration.node(start, start + node.nodeSize, {
                    class: 'studio-active-block',
                  }),
                ])
              : DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
function BlockPreview({ attrs }: { attrs: Record<string, unknown> }) {
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  const serialized = JSON.stringify(attrs);
  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      studioRequest<{ contentHtml: string }>('/preview', {
        method: 'POST',
        body: JSON.stringify({
          slug: 'block-preview',
          body: {
            title: '',
            description: '',
            tags: [],
            postType: 'note',
            document: {
              type: 'doc',
              content: [
                { type: 'catalogBlock', attrs: JSON.parse(serialized) },
              ],
            },
          },
        }),
      })
        .then((result) => {
          if (current) {
            setHtml(result.contentHtml);
            setError('');
          }
        })
        .catch((error) => {
          if (current) setError(error.message);
        });
    }, 400);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [serialized]);
  return (
    <div>
      {html && (
        <div
          className="studio-block-preview prose prose-theme max-w-none"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
      {error && <p role="status">Preview unavailable: {error}</p>}
    </div>
  );
}
function SourceView({ node, updateAttributes, deleteNode }: NodeViewProps) {
  return (
    <NodeViewWrapper className="studio-source" contentEditable={false}>
      <div className="studio-block-heading">
        <strong>Imported MDX</strong>
        <button
          className="feeds-button"
          onClick={deleteNode}
          aria-label="Remove imported MDX"
        >
          Remove
        </button>
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
export const MdxSource = Node.create({
  name: 'mdxSource',
  group: 'block',
  atom: true,
  addAttributes: () => ({ source: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-mdx-source]' }],
  renderHTML: ({ HTMLAttributes }) => [
    'div',
    { ...HTMLAttributes, 'data-mdx-source': '' },
  ],
  addNodeView: () => ReactNodeViewRenderer(SourceView),
});
export function makeCatalogBlock(
  entries: CatalogEntry[] | (() => CatalogEntry[])
) {
  function CatalogView({ node, updateAttributes, deleteNode }: NodeViewProps) {
    const entry = (typeof entries === 'function' ? entries() : entries).find(
      (item) => item.id === node.attrs.id && item.version === node.attrs.version
    );
    const props = node.attrs.props as Record<string, unknown>;
    const [editing, setEditing] = useState(false);
    const fieldsId = useId();
    const editButton = useRef<HTMLButtonElement>(null);
    const fields = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (editing)
        fields.current?.querySelector<HTMLElement>('input, textarea')?.focus();
    }, [editing]);
    function finishEditing() {
      setEditing(false);
      editButton.current?.focus({ preventScroll: true });
    }
    return (
      <NodeViewWrapper className="studio-catalog-block" contentEditable={false}>
        <div className="studio-block-heading">
          <strong>{entry?.name || String(node.attrs.id)}</strong>
          <button
            ref={editButton}
            className="feeds-button"
            aria-expanded={editing}
            aria-controls={fieldsId}
            onClick={() => (editing ? finishEditing() : setEditing(true))}
          >
            <Icon name="pen-line" /> {editing ? 'Done' : 'Edit block'}
          </button>
          <button
            className="feeds-button"
            onClick={deleteNode}
            aria-label={`Remove ${entry?.name || 'block'}`}
          >
            Remove
          </button>
        </div>
        <BlockPreview attrs={node.attrs} />
        <div
          ref={fields}
          id={fieldsId}
          className="studio-block-details"
          hidden={!editing}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              finishEditing();
            }
          }}
        >
          <p>
            {entry?.description ||
              'This saved block is preserved. Its catalog entry is unavailable.'}
          </p>
          {entry &&
            Object.entries(entry.properties).map(([key, property]) => (
              <label key={key}>
                {key}
                {property.required ? ' *' : ''}
                {property.type === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={Boolean(props[key])}
                    onChange={(event) =>
                      updateAttributes({
                        props: { ...props, [key]: event.target.checked },
                      })
                    }
                  />
                ) : (
                  <input
                    type={property.type === 'number' ? 'number' : 'text'}
                    value={String(props[key] ?? '')}
                    onChange={(event) =>
                      updateAttributes({
                        props: {
                          ...props,
                          [key]:
                            property.type === 'number'
                              ? Number(event.target.value)
                              : event.target.value,
                        },
                      })
                    }
                  />
                )}
                <small>{property.description}</small>
              </label>
            ))}
          {node.attrs.children !== null && (
            <label>
              Content
              <textarea
                value={String(node.attrs.children || '')}
                onChange={(event) =>
                  updateAttributes({ children: event.target.value })
                }
              />
            </label>
          )}
          <small>{entry?.accessibility}</small>
        </div>
      </NodeViewWrapper>
    );
  }
  return Node.create({
    name: 'catalogBlock',
    group: 'block',
    atom: true,
    addAttributes: () => ({
      id: { default: '' },
      version: { default: '1' },
      props: { default: {} },
      children: { default: null },
    }),
    parseHTML: () => [{ tag: 'div[data-catalog-block]' }],
    renderHTML: ({ HTMLAttributes }) => [
      'div',
      { ...HTMLAttributes, 'data-catalog-block': '' },
    ],
    addNodeView: () => ReactNodeViewRenderer(CatalogView),
  });
}
