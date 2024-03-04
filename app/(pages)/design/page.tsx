import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next/types';

import { fetchDribbleShots } from '@/lib/data/dribbble';

export const metadata: Metadata = {
  title: 'Design Portfolio',
  description:
    "Willie doesn't just program things. He also designs them. Come see his design portfolio and case studies here",
  openGraph: {
    title: 'Design Portfolio',
    description:
      "Willie doesn't just program things. He also designs them. Come see his design portfolio and case studies here.",
    images: ['/assets/meta/playlist-cover.png'],
    url: '/design',
  },
};

/**
 * A page for displaying my design portfolio.
 *
 * Route: /design
 *
 * TODO: Add a proper design portfolio page
 */
export default async function DesignPortfolioPage() {
  const shots = await fetchDribbleShots();
  return (
    <div className="">
      <section className="-mt-[100px] pt-[100px] px-6 pb-12 md:grid md:grid-cols-12 md:gap-x-4 hero">
        <div className="mt-16 md:col-start-1 md:col-span-12 lg:col-start-2 lg:col-span-10 space-y-4 text-on-primary">
          <div className="text-display-medium">Design</div>
          <div className="text-headline-large">
            Sometimes it&apos;s easier to make a mockup than to write code.
          </div>
        </div>
      </section>
      <main className="container min-h-[75vh] mx-auto p-6">
        <div className="text-headline-small text-center">
          soon to be updated&hellip;
        </div>
        <div className="mt-8">
          <ul className="mx-auto space-y-4 columns-1">
            {shots.map((shot) => {
              // TODO: Actually make this good with proper portfolio design
              return (
                <li key={shot.id} className="mx-auto w-[800px]">
                  <Link href={shot.html_url}>
                    <Image
                      src={shot.images.hidpi}
                      alt={''}
                      width={800}
                      height={600}
                    />
                    {/* TODO: Add alt text to all images */}
                    <div className="mt-4 text-headline-large text-center">
                      {shot.title}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}
