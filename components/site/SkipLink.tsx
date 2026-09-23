'use client';

import SiteLink from '@/components/link/SiteLink';

/**
 * The first tab stop on every page: a way past the top bar, or the
 * homepage's rail, straight to the page's content. It stays out of sight
 * until it takes focus. Every page gives its `<main>` the id `main`, so the
 * jump works without scripts.
 *
 * A soft navigation leaves the previous page in the document, hidden, so
 * a plain jump to `#main` can land on that copy. With scripts running,
 * the link moves focus to whichever `<main>` is actually on screen.
 */
export default function SkipLink() {
  return (
    <SiteLink
      href="#main"
      className="sr-only rounded-full bg-primary text-label-large font-semibold text-on-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:px-4 focus:py-2.5"
      onClick={(event) => {
        const main = [...document.querySelectorAll<HTMLElement>('main')].find(
          (element) => element.getClientRects().length > 0
        );
        if (!main) return;
        event.preventDefault();
        main.tabIndex = -1;
        main.focus();
      }}
    >
      Skip to content
    </SiteLink>
  );
}
