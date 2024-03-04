import Link from 'next/link';
import type { Metadata } from 'next/types';

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
      <main className="p-lg gridded max-w-breakpoint-2xl mx-auto">
        <div className="mt-8 mb-8 tablet:row-span-1 tablet:col-start-2 tablet:col-span-8">
          <div className="text-display-small font-display">
            What I&apos;m Doing Now
          </div>
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
        {/* TODO: Migrate this to plain text or YAML file or something */}
        <section
          id="recent"
          className="py-lg tablet:row-span-1 tablet:col-start-2 tablet:col-span-8"
        >
          <h1 className="text-title-large">Recently</h1>
          <ul className="mt-sm space-y-sm">
            <NowItem date="June 2022">
              Hosted some CS workshops for the{' '}
              <a
                className="text-primary hover:underline focus:underline underline-offset-2"
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
              <a
                className="text-primary hover:underline focus:underline underline-offset-2"
                href="https://sg.utdallas.edu"
              >
                Student Government
              </a>
            </NowItem>
            <NowItem date="August 2023">
              Graduated with my bachelor&apos;s degree
            </NowItem>
            <NowItem date="October 2023">
              Built an app for a UNESCO media literacy hackathon
            </NowItem>
          </ul>
        </section>
        <section
          id="current"
          className="py-lg tablet:row-span-1 tablet:col-start-2 tablet:col-span-8"
        >
          <h1 className="text-title-large">Currently</h1>
          <ul className="mt-sm space-y-sm">
            <NowItem date="February 2023">
              Launching an{' '}
              <a
                href="https://love.williecubed.dev"
                className="text-primary hover:underline focus:underline underline-offset-2"
              >
                AI experiment
              </a>{' '}
              about love
            </NowItem>
            <NowItem date="February 2023">
              Presenting{' '}
              <Link
                href="/projects/connie"
                className="text-primary hover:underline focus:underline underline-offset-2"
              >
                Connie
              </Link>{' '}
              for{' '}
              <a
                className="text-primary hover:underline focus:underline underline-offset-2"
                href="https://developforgood.org"
              >
                Develop for Good&apos;s
              </a>{' '}
              demo day
            </NowItem>
            <NowItem date="February 2023">
              Building an app to let me talk to humans better
            </NowItem>
          </ul>
        </section>
        <section
          id="later"
          className="py-lg tablet:row-span-1 tablet:col-start-2 tablet:col-span-8"
        >
          <h1 className="text-title-large">Later</h1>
          <ul className="mt-sm space-y-sm">
            <NowItem date="March 2024">
              Launching a better journal for your memories
            </NowItem>
            <NowItem date="April 2024">
              Starting a miniseries on the state of the United States
            </NowItem>
            <NowItem date="June 2024">
              Releasing{' '}
              <Link
                className="text-primary hover:underline focus:underline underline-offset-2"
                href="/media"
              >
                The Willie Diaries
              </Link>
            </NowItem>
          </ul>
        </section>
      </main>
    </div>
  );
}
