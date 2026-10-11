'use client';
import { Node } from '@tiptap/core';
import {
  type NodeViewProps,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react';
import { useEffect, useState } from 'react';

import type { CatalogEntry } from '@/lib/studio/catalog';

import { studioRequest } from './api';

export type { CatalogEntry } from '@/lib/studio/catalog';
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
    return (
      <NodeViewWrapper className="studio-catalog-block" contentEditable={false}>
        <div className="studio-block-heading">
          <strong>{entry?.name || String(node.attrs.id)}</strong>
          <button
            className="feeds-button"
            onClick={deleteNode}
            aria-label={`Remove ${entry?.name || 'block'}`}
          >
            Remove
          </button>
        </div>
        <BlockPreview attrs={node.attrs} />
        <details className="studio-block-details">
          <summary>Edit block</summary>
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
        </details>
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
