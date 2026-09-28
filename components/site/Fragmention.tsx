'use client';

import { useEffect } from 'react';

import { findWords, fragmentionWords } from '@/lib/fragmention';

const HIGHLIGHT = 'fragmention';

/** Text a reader can see; a sr-only heading measures one pixel square. */
function shown(element: Element): boolean {
  if (element.checkVisibility?.({ visibilityProperty: true }) === false) {
    return false;
  }
  const box = element.getBoundingClientRect();
  return box.width > 1 && box.height > 1;
}

function findRange(root: Element, words: string): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest('script, style, noscript, template')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    const found = findWords(text.data, words);
    if (!found || !text.parentElement || !shown(text.parentElement)) continue;
    const range = document.createRange();
    range.setStart(text, found[0]);
    range.setEnd(text, found[1]);
    return range;
  }
  return null;
}

// The words are highlighted through the CSS Custom Highlight API rather
// than wrapped in a <mark>. The effect runs before a streamed section of
// the page has hydrated, and a <mark> inside it made React find text it
// did not render (minified React error 418) and throw away the server
// HTML of the whole <main>. A highlight changes no node, so hydration
// never sees it.
const highlights =
  typeof CSS !== 'undefined' && 'highlights' in CSS ? CSS.highlights : null;

/**
 * The page on screen. Next keeps the pages a visitor left in the document,
 * hidden by React's <Activity>, so the first <main> may be one of those.
 */
function visibleMain(): Element {
  for (const main of document.querySelectorAll('main')) {
    if (main.checkVisibility?.() ?? true) return main;
  }
  return document.body;
}

function apply() {
  highlights?.delete(HIGHLIGHT);
  const words = fragmentionWords(window.location.hash);
  if (!words) return;
  const range = findRange(visibleMain(), words);
  if (!range) return;
  highlights?.set(HIGHLIGHT, new Highlight(range));
  const box = range.getBoundingClientRect();
  window.scrollBy({ top: box.top - (window.innerHeight - box.height) / 2 });
}

/**
 * Follows a fragmention (lib/fragmention.ts) on load, on a hash change, and
 * after a client-side navigation, which changes the URL without a
 * hashchange event. Renders nothing; the root layout mounts it once.
 */
export default function Fragmention() {
  useEffect(() => {
    apply();
    window.addEventListener('hashchange', apply);
    const navigation = 'navigation' in window ? window.navigation : null;
    navigation?.addEventListener('navigatesuccess', apply);
    return () => {
      window.removeEventListener('hashchange', apply);
      navigation?.removeEventListener('navigatesuccess', apply);
      highlights?.delete(HIGHLIGHT);
    };
  }, []);
  return null;
}
