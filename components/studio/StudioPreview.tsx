'use client';

import { useEffect, useRef, useState } from 'react';

/** The preview remains opaque; its only message is its own rendered height. */
export default function StudioPreview({
  html,
  title,
  className = 'studio-preview',
}: {
  html: string;
  title: string;
  className?: string;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(240);
  const [documentHtml, setDocumentHtml] = useState<string | null>(null);
  useEffect(() => {
    const theme = getComputedStyle(document.documentElement);
    const font = getComputedStyle(document.body).fontFamily;
    const values = ['ground', 'ink', 'muted', 'accent', 'line', 'tray', 'card']
      .map(
        (token) =>
          `--color-${token}:${theme.getPropertyValue(`--color-${token}`)};`
      )
      .join('');
    const scheme = theme.colorScheme;
    const styles = `<style>:root{${values}color-scheme:${scheme}}body{font-family:${font};color:var(--color-ink);background:var(--color-ground);margin:0;padding:0}a{color:var(--color-accent)}pre,.callout{background:var(--color-tray)}.callout{border-color:var(--color-accent)}figcaption,.fallback{color:var(--color-muted)}td,th,.fallback{border-color:var(--color-line)}.generated{background:var(--color-ground);border:0}</style>`;
    const measure = `<script>new ResizeObserver(()=>parent.postMessage({type:'studio-preview-height',height:document.body.getBoundingClientRect().height},'*')).observe(document.body);</script>`;
    setHeight(240);
    setDocumentHtml(html + styles + measure);
    function resized(event: MessageEvent) {
      if (
        event.source !== frame.current?.contentWindow ||
        event.data?.type !== 'studio-preview-height'
      )
        return;
      const next = Number(event.data.height);
      if (Number.isFinite(next))
        setHeight(Math.max(1, Math.min(100_000, Math.ceil(next + 8))));
    }
    window.addEventListener('message', resized);
    return () => window.removeEventListener('message', resized);
  }, [html]);
  // Publish a complete document on first mount; a source change replaces the
  // opaque frame rather than navigating an existing empty document.
  return documentHtml === null ? null : (
    <iframe
      key={documentHtml}
      ref={frame}
      title={title}
      sandbox="allow-scripts"
      srcDoc={documentHtml}
      className={className}
      style={{ height }}
    />
  );
}
