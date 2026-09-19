import { createElement } from 'react';

interface PagefindTriggerProps {
  /** A smaller button, sized for the top bar. */
  compact?: boolean;
  /** Drops the keyboard-shortcut hint, leaving an icon-only button. */
  hideShortcut?: boolean;
}

/**
 * Pagefind's Component UI defines these as custom elements. They are created
 * by name instead of written as JSX, so the project needs no global JSX type
 * declarations for them.
 */
export function PagefindTrigger({
  compact = false,
  hideShortcut = false,
}: PagefindTriggerProps) {
  return createElement('pagefind-modal-trigger', {
    ...(compact ? { compact: true } : {}),
    ...(hideShortcut ? { 'hide-shortcut': true } : {}),
  });
}

export function PagefindDialog() {
  return createElement('pagefind-modal');
}
