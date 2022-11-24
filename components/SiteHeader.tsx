import Link from 'next/link';

interface SiteHeaderProps {
  /**
   * A flag to show the name link back to the home page.
   */
  showTitle?: boolean;
}

export default function SiteHeader({ showTitle = true }: SiteHeaderProps) {
  return (
    <header className="sticky top-0 px-4 lg:px-8 py-2 lg:py-6 bg-white dark:bg-slate-700 shadow-lg z-100">
      <nav className="md:flex container max-w-6xl mx-auto text-center md:text-left justify-center md:justify-left">
        <div className="flex-grow font-bold font-display text-xl">
          {showTitle && <Link href="/">Willie Chalmers III</Link>}
        </div>
        <ol className="flex space-x-4">
          {/* <li>
            <Link href="/research">Research</Link>
          </li>
          <li>
            <Link href="/projects">Projects</Link>
          </li> */}
          <li className="font-bold text-md uppercase">
            <Link href="/media">Media</Link>
          </li>
          <li className="font-bold text-md uppercase">
            <Link href="/resume.pdf">Resume</Link>
          </li>
        </ol>
      </nav>
    </header>
  );
}
