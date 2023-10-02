import Link from 'next/link';
import type { Metadata } from 'next/types';
import SiteFooter from '../components/SiteFooter';

export const metadata: Metadata = {
  title: {
    absolute: 'Willie Chalmers III',
  },
  description:
    'Willie Chalmers III is a student studying computer science at The University of Texas at Dallas and doing research in artficial intelligence. Learn more about him and his projects here.',
  openGraph: {
    title: 'Home',
    siteName: 'Willie Chalmers III',
    description:
      'Willie Chalmers III is a student studying computer science at The University of Texas at Dallas and doing research in artficial intelligence. Learn more about him and his projects here.',
    url: '/',
    type: 'website',
    images: ['/assets/headshot.jpg'],
  },
};

/**
 * The main entrypoint to the site.
 *
 * Route: /
 */
export default function LandingPage() {
  return (
    <>
      <main className="min-h-[90vh] p-4 lg:p-6 flex flex-col">
        <div className="h-full md:grid md:grid-cols-12 md:gap-x-4">
          <section className="md:col-start-1 md:col-end-10 lg:col-start-2 xl:col-end-12">
            <div className="mt-[108px] space-y-4">
              <div className="text-display-medium font-display">Hello!</div>
              <div className="text-display-medium font-display">
                I&apos;m Willie, an aspiring AI researcher.
              </div>
            </div>
            <div className="mt-8 lg:row-start-2 lg:col-span-5">
              <div className="text-display-small font-display">
                I{' '}
                <span
                  className="text-primary hover:underline cursor-pointer"
                  title="(search for the holy grail of artificial general intelligence)"
                >
                  study machine intelligence
                </span>
                <br />
                and{' '}
                <span
                  className="text-accent-dark-2 hover:underline cursor-pointer"
                  title="(create software that uses AI)"
                >
                  build tools
                </span>{' '}
                that bring people together.
              </div>
            </div>
          </section>
          <section
            className="mt-8 lg:mt-24 md:col-start-6 md:col-end-12 lg:row-start-2 md:row-start-2 "
            id="links"
          >
            <h1 className="text-title-large font-bold font-display">My Work</h1>
            <div className="md:flex w-full mt-2 space-y-4 md:space-y-0 md:space-x-4">
              <Link
                href="/research"
                className="block min-h-[240px] flex-1 p-4 border-2 fancy-shadow border-black bg-primary text-white hover:text-neutral-200 content-end"
              >
                {/* The hover:text-white is a temporary hack because of the global.css link styles */}
                <div className="font-display text-headline-small">Research</div>
                <div className="mt-2 font-display">Learn more</div>
              </Link>
              <Link
                href="/projects"
                className="block min-h-[240px] flex-1 p-4 border-2 fancy-shadow border-black bg-accent text-white hover:text-neutral-200"
              >
                <div className="font-display text-headline-small">
                  Personal Projects
                </div>
                <div className="mt-2 font-display">Learn more</div>
              </Link>
            </div>
          </section>
          <section className="bottom-0 inset-0 md:sticky md:top-24 md:mt-24 md:col-start-1 lg:mt-24 lg:col-start-2 md:col-span-4 md:row-start-2">
            <div className="mt-4">
              <h1 className="font-semibold font-display text-title-large">
                Quick links
              </h1>
              <ul className="mt-2 text-title-medium">
                <li>
                  <Link href="/now">See what I&apos;m working on</Link>
                </li>
                {/* <li>
                  <Link href="/about">Learn more about me</Link>
                </li>
                <li>
                  <Link href="/random">See something random</Link>
                </li>
                <li>
                  <Link href="/contact">Contact me</Link>
                </li> */}
              </ul>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
