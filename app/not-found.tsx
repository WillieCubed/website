import type { Metadata } from 'next';
import { cacheLife } from 'next/cache';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import RequestLog from '@/components/not-found/RequestLog';
import TopBar from '@/components/site/TopBar';

import { getInitiatives } from '@/lib/initiatives';
import { site } from '@/lib/site';
import { getAllWritings } from '@/lib/writings';

// Absolute so the title never depends on which segment renders the page;
// it spells out the same string the root title template would.
export const metadata: Metadata = {
  title: { absolute: `Not found · ${site.name}` },
  robots: { index: false },
};

/**
 * Every routed page, for the log's closest-match line. Cached so the
 * page prerenders like the loaders it reads from.
 */
async function routedPaths(): Promise<string[]> {
  'use cache';
  cacheLife('hours');
  const [writings, initiatives] = await Promise.all([
    getAllWritings(),
    getInitiatives(),
  ]);
  // The homepage is left out: every short path is within two edits of "/",
  // and the page already offers a way home.
  return [
    '/writings',
    '/initiatives',
    '/search',
    ...writings.map((writing) => `/writings/${writing.slug}`),
    ...initiatives.flatMap((initiative) => [
      initiative.href,
      ...initiative.parts.map((part) => `${initiative.href}/${part.slug}`),
    ]),
  ];
}

export default async function NotFound() {
  const paths = await routedPaths();
  return (
    <>
      {/* Neither way home prefetches: the homepage's payload would preload
          its tile images here, where none of them show. */}
      <TopBar column="content" prefetchHome={false} />
      <main
        id="main"
        className="mx-auto flex max-w-[840px] flex-col gap-7 px-5 pb-8 pt-10"
      >
        <h1 className="text-display-small">No page lives at this address.</h1>
        <RequestLog paths={paths} />
        <div>
          <SiteLink
            preview={false}
            prefetch={false}
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-label-large font-semibold text-on-primary transition-colors hover:bg-primary/90"
          >
            <Icon name="arrow-left" size={16} />
            Back to the homepage
          </SiteLink>
        </div>
      </main>
    </>
  );
}
