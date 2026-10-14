'use client';

import { useEffect, useState } from 'react';

import WidgetFrames from '@/components/mdx/WidgetFrames';
import '@/components/mdx/image-layout.css';

import { imageLayout } from '@/lib/writings/image-layout';

import { studioRequest } from './api';

export default function BlockPreview({
  attrs,
}: {
  attrs: Record<string, unknown>;
}) {
  const [html, setHtml] = useState('');
  const [widget, setWidget] = useState<{
    source: string;
    title: string;
    key: string;
  } | null>(null);
  const [error, setError] = useState('');
  // Layout is presentation-only. Keep the mounted image while its width animates.
  const serialized = JSON.stringify(
    attrs.id === 'figure'
      ? {
          ...attrs,
          props: {
            ...(attrs.props as Record<string, unknown>),
            size: undefined,
          },
        }
      : attrs
  );
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const timer = setTimeout(() => {
      studioRequest<{ contentHtml: string }>('/preview', {
        method: 'POST',
        signal,
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
          if (!signal.aborted) {
            const preview = new DOMParser().parseFromString(
              result.contentHtml,
              'text/html'
            );
            const frame = preview.querySelector<HTMLIFrameElement>(
              'iframe[data-studio-widget]'
            );
            const nextWidget = frame
              ? {
                  source: frame.getAttribute('srcdoc') ?? '',
                  title: frame.title,
                  key: frame.getAttribute('data-studio-widget-key') ?? '',
                }
              : null;
            // Property and portable edits keep the approved implementation mounted.
            setWidget((previous) =>
              nextWidget && previous?.key === nextWidget.key
                ? previous
                : nextWidget
            );
            setHtml(frame ? '' : preview.body.innerHTML);
            setError('');
          }
        })
        .catch((error) => {
          if (!signal.aborted) setError(error.message);
        });
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [serialized]);
  return (
    <div>
      {widget && widget.key.startsWith(`${attrs.id}:${attrs.version}:`) && (
        <WidgetFrames widgetProps={attrs.props as Record<string, unknown>}>
          <figure className="studio-block-preview prose prose-theme max-w-none">
            <iframe
              key={widget.key}
              data-studio-widget
              className="w-full rounded-lg border-0"
              style={{ height: 240 }}
              title={widget.title}
              sandbox="allow-scripts"
              referrerPolicy="no-referrer"
              srcDoc={widget.source}
            />
          </figure>
        </WidgetFrames>
      )}
      {html && (
        <WidgetFrames>
          <div
            className="studio-block-preview prose prose-theme max-w-none"
            ref={(element) => {
              if (attrs.id !== 'figure') return;
              const figure = element?.querySelector('figure');
              if (figure)
                figure.dataset.layout = imageLayout(
                  (attrs.props as Record<string, unknown>)?.size
                );
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </WidgetFrames>
      )}
      {error && <p role="status">Preview unavailable: {error}</p>}
    </div>
  );
}
