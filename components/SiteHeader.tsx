import Link from 'next/link';

interface SiteHeaderProps {
  /**
   * A flag to show the name link back to the home page.
   */
  showTitle?: boolean;
}

export default function SiteHeader({ showTitle = true }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 px-4 lg:px-8 py-2 lg:py-5 bg-primary-dark-2 text-white border-b-4 border-black z-50">
      <nav className="md:flex container max-w-6xl mx-auto text-center md:text-left justify-center md:justify-left">
        <div className="flex-grow font-bold py-2 lg:py-0 font-display text-2xl">
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
          <li className="font-bold font-display text-2xl">
            <Link
              href="/projects"
              className="hover:underline focus:underline underline-offset-4"
            >
              Projects
            </Link>
          </li>
          {/* <li>
            <Link href="/research">Research</Link>
          </li> */}
          {/* <li className="font-bold font-display text-2xl">
            <Link href="/media">Media</Link>
          </li> */}
          <li className="font-bold font-display text-2xl">
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
