import { createElement } from 'react';

/**
 * Pagefind's Component UI defines these as custom elements. They are created
 * by name instead of written as JSX, so the project needs no global JSX type
 * declarations for them.
 */
export function PagefindTrigger({ compact = false }: { compact?: boolean }) {
  return createElement(
    'pagefind-modal-trigger',
    compact ? { compact: true } : null
  );
}

export function PagefindDialog() {
  return createElement('pagefind-modal');
}
