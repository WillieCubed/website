'use client';

import Link from 'next/link';

interface SiteHeaderProps {
  /**
   * A flag to show the name link back to the home page.
   */
  showTitle?: boolean;
}

export default function SiteHeader({ showTitle = true }: SiteHeaderProps) {
  return (
    <header className="mx-auto container sticky top-0 z-50 bg-light-1 dark:bg-slate-900">
      <nav className="sticky top-4 md:flex mx-auto px-4 lg:my-4 lg:pb-4 pb-2 lg:py-4 text-center md:text-left justify-center md:justify-left border-4 border-black ">
        <div className="flex-grow font-bold py-2 lg:py-0 font-display text-xl">
          {showTitle && (
            <Link
              href="/"
              className="hover:underline focus:underline underline-offset-4"
            >
              Willie Chalmers III
            </Link>
          )}
        </div>
        <ul className="flex space-x-6 py-2 lg:py-0">
          <li className="font-bold font-display text-xl">
            <Link
              href="/projects"
              className="hover:underline focus:underline underline-offset-4"
            >
              Projects
            </Link>
          </li>
          <li className="font-bold font-display text-xl">
            <Link
              href="/research"
              className="hover:underline focus:underline underline-offset-4"
            >
              Research
            </Link>
          </li>
          {/* <li className="font-bold font-display text-xl">
            <Link href="/media">Media</Link>
          </li> */}
          <li className="font-bold font-display text-xl">
            <Link
              href="/resume.pdf"
              className="hover:underline focus:underline underline-offset-4"
            >
              Resume
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
