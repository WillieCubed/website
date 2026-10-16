'use client';

import { type ReactNode, useEffect, useRef } from 'react';

/** Trusted host bridge for presentation and optional editor settings. */
interface WidgetFramesProps {
  children: ReactNode;
  widgetProps?: Record<string, unknown>;
}

export default function WidgetFrames({
  children,
  widgetProps,
}: WidgetFramesProps) {
  const serializedProps =
    widgetProps === undefined ? null : JSON.stringify(widgetProps);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const frames = Array.from(
      root.querySelectorAll<HTMLIFrameElement>('iframe[data-studio-widget]')
    );
    function theme(frame: HTMLIFrameElement) {
      const styles = getComputedStyle(frame);
      const colors = Object.fromEntries(
        ['ground', 'ink', 'muted', 'accent', 'line', 'tray'].map((key) => [
          key,
          styles.getPropertyValue(`--color-${key}`).trim(),
        ])
      );
      return {
        colors,
        font: getComputedStyle(document.body).fontFamily,
        scheme: styles.colorScheme,
        tokens: Object.fromEntries(
          [
            'text-title-medium',
            'text-title-medium--line-height',
            'text-title-medium--font-weight',
            'text-body-medium',
            'text-body-medium--line-height',
            'text-label-large',
            'text-label-large--line-height',
            'text-label-large--font-weight',
            'text-label-medium',
            'text-label-medium--line-height',
            'ease-site',
          ].map((key) => [key, styles.getPropertyValue(`--${key}`).trim()])
        ),
      };
    }
    function applyTheme() {
      for (const frame of frames)
        frame.contentWindow?.postMessage(
          { type: 'studio-widget-theme', theme: theme(frame) },
          '*'
        );
    }
    function applyProps() {
      if (!serializedProps || serializedProps.length > 200_000) return;
      const props = JSON.parse(serializedProps);
      if (!props || typeof props !== 'object' || Array.isArray(props)) return;
      for (const frame of frames)
        frame.contentWindow?.postMessage(
          { type: 'studio-widget-props', props },
          '*'
        );
    }
    function loaded() {
      applyTheme();
      applyProps();
    }
    function resized(event: MessageEvent) {
      if (event.data?.type !== 'studio-widget-size') return;
      const frame = frames.find((item) => item.contentWindow === event.source);
      const height = event.data.height;
      if (frame && typeof height === 'number' && Number.isFinite(height))
        frame.style.height = `${Math.max(44, Math.min(4096, Math.ceil(height)))}px`;
    }
    for (const frame of frames) frame.addEventListener('load', loaded);
    const observer = new MutationObserver(applyTheme);
    observer.observe(root, { childList: true, subtree: true });
    // Editor decorations live above this wrapper. Keep opaque frames in step
    // with the focused surface without exposing anything beyond presentation.
    const editorObserver = new MutationObserver(applyTheme);
    const editor = root.closest('.studio-prose');
    let focusFrame = 0;
    function focusChanged() {
      cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(() => {
        root?.toggleAttribute(
          'data-widget-active',
          frames.includes(document.activeElement as HTMLIFrameElement)
        );
        applyTheme();
      });
    }
    document.addEventListener('focusin', focusChanged);
    window.addEventListener('blur', focusChanged);
    window.addEventListener('focus', focusChanged);
    editor?.addEventListener('focusout', focusChanged);
    if (editor)
      editorObserver.observe(editor, {
        attributes: true,
        subtree: true,
        attributeFilter: ['class', 'data-studio-focus'],
      });
    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, { attributes: true });
    window.addEventListener('message', resized);
    loaded();
    return () => {
      observer.disconnect();
      editorObserver.disconnect();
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('focusin', focusChanged);
      window.removeEventListener('blur', focusChanged);
      window.removeEventListener('focus', focusChanged);
      root.removeAttribute('data-widget-active');
      editor?.removeEventListener('focusout', focusChanged);
      themeObserver.disconnect();
      for (const frame of frames) frame.removeEventListener('load', loaded);
      window.removeEventListener('message', resized);
    };
  }, [children, serializedProps]);
  return (
    <div ref={container} className="studio-widget-frames">
      {children}
    </div>
  );
}
