'use client';

import { useEffect } from 'react';

import { PagefindDialog } from './pagefind';
import './search.css';

const COMPONENT_UI = '/pagefind/pagefind-component-ui';

/**
 * Adds Pagefind's Component UI to the page once. The script defines the
 * <pagefind-modal> and <pagefind-modal-trigger> elements. Each trigger
 * registers the ⌘K / Ctrl+K shortcut while it is on the page, so the shortcut
 * works only on pages that render one. The search index and its WASM load
 * later still, on the first search.
 */
function loadComponentUi() {
  if (document.querySelector('script[data-pagefind-ui]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `${COMPONENT_UI}.css`;
  document.head.append(link);

  const script = document.createElement('script');
  script.type = 'module';
  script.src = `${COMPONENT_UI}.js`;
  script.dataset.pagefindUi = '';
  script.onerror = () => {
    // Drop the failed tags so the next click can try again, instead of leaving
    // every trigger dead until a full reload.
    script.remove();
    link.remove();
    document.addEventListener('pointerdown', loadComponentUi, { once: true });
  };
  document.head.append(script);
}

/**
 * Mounts the search dialog and loads its script once the page is idle, so
 * search never competes with first paint. Triggers elsewhere on the page
 * (`<pagefind-modal-trigger>`) find this dialog through the shared default
 * instance.
 */
export default function SearchModal() {
  useEffect(() => {
    // A `typeof` test on the method, not `'requestIdleCallback' in window`:
    // the `in` form narrows `window` to `never` on the fallback path, because
    // lib.dom declares the method as always present (Safari still lacks it).
    if (typeof window.requestIdleCallback === 'function') {
      // The timeout keeps a page that never goes idle from losing the shortcut.
      const id = window.requestIdleCallback(loadComponentUi, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(loadComponentUi, 200);
    return () => window.clearTimeout(id);
  }, []);

  return <PagefindDialog />;
}
