import { cacheLife } from 'next/cache';
import type { Metadata } from 'next/types';

import SiteLink from '@/components/link/SiteLink';

import { getAllNowEntries } from '@/lib/data/now-loader';
import { pageMetadata } from '@/lib/site';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

type NowItemState = {
  date: Date;
};

function NowItem({ date, children }: React.PropsWithChildren<NowItemState>) {
  return (
    <li className="flex text-title-small">
      <span className="shrink-0 inline-block w-32 font-bold font-display">
        {formatDate(date)}
      </span>
      <span>{children}</span>
    </li>
  );
}

export const metadata: Metadata = pageMetadata({
  title: 'Now',
  description: "See what Willie has been working on and what's coming up next.",
  path: '/now',
});

/**
 * A page that describes what I'm doing right now.
 */
/**
 * Buckets the entries by age. It runs in a cache scope because it needs the
 * clock, which the prerenderer only allows inside cached or dynamic code,
 * and an hour of staleness is fine for a page about the current month.
 */
async function loadNowSections() {
  'use cache';
  cacheLife('hours');
  const nowEntries = await getAllNowEntries();
  const now = new Date();
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(now.getFullYear() - 2);
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(now.getMonth() - 1);
  const byNewest = (a: { date: Date }, b: { date: Date }) =>
    new Date(b.date).getTime() - new Date(a.date).getTime();

  return {
    recentEntries: nowEntries
      .filter((entry) => {
        const date = new Date(entry.date);
        return date >= twoYearsAgo && date <= oneMonthAgo;
      })
      .sort(byNewest),
    currentEntries: nowEntries
      .filter((entry) => {
        const date = new Date(entry.date);
        return date > oneMonthAgo && date <= now;
      })
      .sort(byNewest),
    laterEntries: nowEntries
      .filter((entry) => new Date(entry.date) > now)
      .sort(byNewest),
  };
}

export default async function NowPage() {
  const { recentEntries, currentEntries, laterEntries } =
    await loadNowSections();

  return (
    <div className="min-h-[75vh]">
      <main className="p-lg gridded max-w-breakpoint-lg mx-auto">
        <div className="mt-8 mb-8 tablet:row-span-1 tablet:col-start-2 tablet:col-span-8">
          <h1 className="text-display-small font-display">
            What I&apos;m Doing Now
          </h1>
          <div className="mt-lg space-y-lg *:text-body-medium">
            <p>
              Yes, it&apos;s{' '}
              <a
                href="https://nownownow.com/about"
                className="text-primary hover:underline focus:underline underline-offset-2"
              >
                inspired
              </a>{' '}
              by Derek Sivers.
            </p>
          </div>
        </div>
        <section
          id="bigPicture"
          className="py-lg tablet:row-span-1 tablet:col-start-2 tablet:col-span-6"
        >
          <h2 className="text-headline-medium">The Big Picture</h2>
          <div className="text-body-medium mt-lg space-y-sm">
            <p>
              I am working on the{' '}
              <SiteLink
                href="https://reasonabletech.co"
                className="text-primary hover:underline focus:underline underline-offset-2"
              >
                Reasonable Tech Company
              </SiteLink>
              , a startup that builds tools to augment humans&apos; ability to
              learn and do work. We&apos;re focused on Project Haystack, a
              platform for creating and managing autonomous knowledge agents.
            </p>
            <p>
              I&apos;m also working on{' '}
              <SiteLink
                href="https://youtube.com/@williecubed?si=V6VkIO7Szf3OwoFQ"
                className="text-primary hover:underline focus:underline underline-offset-2"
              >
                The Willie Diaries,
              </SiteLink>{' '}
              a video diary that documents what it&apos;s like to be a
              20-something in 21st century America.
            </p>
          </div>
        </section>
        {/* <section
          id="recent"
          className="py-lg tablet:row-span-1 tablet:col-start-2 tablet:col-span-8"
        >
          <h2 className="text-title-large">Recently</h2>
          <ul className="mt-sm space-y-sm">
            {recentEntries.map(entry => (
              <NowItem key={entry.date.toString()} date={entry.date}>
                <div dangerouslySetInnerHTML={{ __html: entry.content }} />
              </NowItem>
            ))}
          </ul>
        </section>
        <section
          id="current"
          className="py-lg tablet:row-span-1 tablet:col-start-2 tablet:col-span-8"
        >
          <h2 className="text-title-large">Currently</h2>
          <ul className="mt-sm space-y-sm">
            {currentEntries.map(entry => (
              <NowItem key={entry.date.toString()} date={entry.date}>
                <div dangerouslySetInnerHTML={{ __html: entry.content }} />
              </NowItem>
            ))}
          </ul>
        </section>
        <section
          id="later"
          className="py-lg tablet:row-span-1 tablet:col-start-2 tablet:col-span-8"
        >
          <h2 className="text-title-large">Soon</h2>
          <ul className="mt-sm space-y-sm">
            {laterEntries.map(entry => (
              <NowItem key={entry.date.toString()} date={entry.date}>
                <div dangerouslySetInnerHTML={{ __html: entry.content }} />
              </NowItem>
            ))}
          </ul>
        </section> */}
      </main>
    </div>
  );
}
