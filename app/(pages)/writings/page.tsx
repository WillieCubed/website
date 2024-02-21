import type { Metadata } from 'next/types';
import { getAllWritings } from '../../../lib/writings';
import WritingItem from '../../../components/writings/WritingItem';

export const metadata: Metadata = {
  title: 'Writings',
  description:
    'See some of the things I have written here. No promises on quality.',
  openGraph: {
    title: "Willie's Writings",
    description:
      'See some of the things I have written here. No promises on quality.',
    url: '/writings',
  },
};

export default async function WritingsPage() {
  const writings = await getAllWritings();
  const writingComponents = writings.map((writing) => {
    return <WritingItem key={writing.slug} writing={writing} />;
  });
  return (
    <main className="max-w-breakpoint-2xl mx-auto tablet:grid tablet:grid-cols-8 tablet:gap-lg">
      <section className="tablet:col-span-6 tablet:col-start-2 mt-16">
        <div className="space-y-xl px-lg desktop-large:px-0">
          <div className="space-y-md">
            <div className="text-display-small">Writings</div>
            <div className="text-headline-medium">Just some notes.</div>
          </div>
          <div className="*:text-body-medium space-y-sm">
            <p>
              This isn&apos;t a blog. I&apos;ll dump some thoughts here from
              time to time.
            </p>
          </div>
        </div>
      </section>
      <section className="min-h-[50vh] tablet:col-span-6 tablet:col-start-2 space-y-lg pt-2xl pb-2xl px-lg desktop-large:px-0">
        {writingComponents}
      </section>
    </main>
  );
}
