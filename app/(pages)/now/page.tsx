import type { Metadata } from 'next/types';
import Link from 'next/link';

type NowItemData = {
  date: string;
};

function NowItem({ date, children }: React.PropsWithChildren<NowItemData>) {
  return (
    <li className="flex text-title-small">
      <span className="shrink-0 inline-block w-32 font-bold font-display">
        {date}
      </span>
      <span>{children}</span>
    </li>
  );
}

export const metadata: Metadata = {
  title: 'What Now? - Willie Chalmers III',
  description: "See what Willie has been working on and what's coming up next.",
  openGraph: {
    title: "Willie's Now Page",
    description: "See what I'm up to now and what's coming up next.",
    url: '/now',
  },
};

/**
 * A page that describes what I'm doing right now.
 */
export default function NowPage() {
  return (
    <div className="min-h-[75vh]">
      <main className="p-4 gridded max-w-breakpoint-2xl mx-auto">
        <div className="mt-8 mb-8 tablet:row-span-1 tablet:col-start-2 tablet:col-span-8">
          <div className="text-display-medium font-display">
            What I&apos;m Doing Now
          </div>
        </div>
        <section
          id="recent"
          className="py-4 tablet:row-span-1 tablet:col-start-2 tablet:col-span-8"
        >
          <h1 className="text-title-large">Recently</h1>
          <ul className="mt-2 space-y-2">
            <NowItem date="June 2022">
              Hosted some CS workshops for the{' '}
              <a
                className="text-primary"
                href="https://honors.utdallas.edu/clark-summer-research-program"
              >
                2022 Clark Summer Research Program
              </a>
            </NowItem>
            <NowItem date="September 2022">
              Started serving as Speaker of the Jonsson School Engineering and
              Computer Science Student Council
            </NowItem>
            <NowItem date="March 2023">
              Got &quot;promoted&quot; to President of the Jonsson School
              Engineering and Computer Science Student Council
            </NowItem>
            <NowItem date="May 2023">
              Finished four years of service as a senator for the UT Dallas{' '}
              <a className="text-primary" href="https://sg.utdallas.edu">
                Student Government
              </a>
            </NowItem>
            <NowItem date="August 2023">
              Graduated with my bachelor&apos;s degree
            </NowItem>
          </ul>
        </section>
        <section
          id="current"
          className="py-4 tablet:row-span-1 tablet:col-start-2 tablet:col-span-8"
        >
          <h1 className="text-title-large">Currently</h1>
          <ul className="mt-2 space-y-2">
            <NowItem date="September 2023">
              Launching{' '}
              <a className="text-primary" href="https://logdate.app">
                LogDate beta
              </a>
            </NowItem>
          </ul>
        </section>
        <section
          id="later"
          className="py-4 tablet:row-span-1 tablet:col-start-2 tablet:col-span-8"
        >
          <h1 className="text-title-large">Later</h1>
          <ul className="mt-2 space-y-2">
            <NowItem date="October 2023">Playing a song on the piano</NowItem>
            <NowItem date="October 2023">
              Starting a miniseries on the state of the United States
            </NowItem>
            <NowItem date="December 2023">
              Releasing{' '}
              <Link className="text-primary" href="/media/the-willie-diaries">
                The Willie Diaries
              </Link>
            </NowItem>
          </ul>
        </section>
      </main>
    </div>
  );
}
