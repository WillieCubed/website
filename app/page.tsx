import Link from 'next/link';
import type { Metadata } from 'next/types';

export const metadata: Metadata = {
  title: '', // Yes, this is intentional; see layout.tsx for template
  description:
    'Willie Chalmers III is a student studying computer science at The University of Texas at Dallas and doing research in artficial intelligence. Learn more about him and his projects here.',
  openGraph: {
    title: 'Home',
    siteName: 'Willie Chalmers III',
    description:
      'Willie Chalmers III is a student studying computer science at The University of Texas at Dallas and doing research in artficial intelligence. Learn more about him and his projects here.',
    url: 'https://williecubed.me',
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
    <main className="min-h-screen p-6 lg:p-[64px] 2xl:p-[128px] flex flex-col">
      <div className="h-full lg:grid lg:grid-cols-12 lg:gap-x-4">
        <section className="lg:col-span-6">
          <div className="mt-16 space-y-4">
            <div className="text-display-large font-display">Hello!</div>
            <div className="text-display-large font-display">
              I&apos;m Willie, an aspiring AI researcher.
            </div>
          </div>
          <div className="mt-8 lg:row-start-2 lg:col-span-5">
            <div className="text-display-medium font-display">
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
          id="links"
          className="mt-8 lg:mt-24 lg:col-start-7 lg:col-span-6 lg:row-start-2"
        >
          <h1 className="text-xl font-bold font-display">My Work</h1>
          <div className="md:flex w-full mt-2 space-y-4 md:space-y-0 md:space-x-4">
            <Link
              href="/research"
              className="block min-h-[240px] flex-1 p-4 border-2 fancy-shadow border-black bg-primary text-white hover:text-neutral-200 content-end"
            >
              {/* The hover:text-white is a temporary hack because of the global.css link styles */}
              <div className="font-display text-display-small">Research</div>
              <div className="mt-2 font-display">Learn more</div>
            </Link>
            <Link
              href="/projects"
              className="block min-h-[240px] flex-1 p-4 border-2 fancy-shadow border-black bg-accent text-white hover:text-neutral-200"
            >
              <div className="font-display text-display-small">
                Personal Projects
              </div>
              <div className="mt-2 font-display">Learn more</div>
            </Link>
          </div>
        </section>
        <section className="mt-8 lg:mt-24 lg:col-start-1 lg:col-span-4 lg:row-start-2">
          <nav>
            <h1 className="font-semibold font-display text-lg">About Me</h1>
            <ul className="mt-2">
              <li>
                <Link href="/about">Bio</Link>
              </li>
              <li>
                <Link href="https://blog.williecubed.me">Blog</Link>
              </li>
            </ul>
          </nav>
          <div className="mt-4">
            <h1 className="font-semibold font-display text-lg">
              Find me elsewhere
            </h1>
            <ul className="mt-2">
              <li>
                <a href="https://twitter.com/WillieCubed">Twitter</a>
              </li>
              <li>
                <a href="https://instagram.com/williecubed">Instagram</a>
              </li>
              <li>
                <a href="https://github.com/Williecubed">GitHub</a>
              </li>
              <li>
                <a href="https://linkedin.com/in/willie-chalmers-iii">
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
