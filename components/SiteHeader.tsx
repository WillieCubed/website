'use client';

import { Menu } from '@headlessui/react';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import expandMenuIcon from '../app/assets/read_more.svg';
import { usePathname } from 'next/navigation';

interface SiteHeaderProps {
  /**
   * A flag to show the name link back to the home page.
   */
  showTitle?: boolean;
}

function getWidthCss(path: string) {
  if (path.startsWith('/projects')) {
    return 'tablet:col-start-1 tablet:col-span-8';
  }
  switch (path) {
    case '/design':
    case '/research':
      return 'tablet:col-start-2 tablet:col-span-6';
    case '/now':
      return 'tablet:col-start-3 tablet:col-span-4';
    case '/404':
      return 'max-w-breakpoint-lg mx-auto';
    case '/':
    default:
      return 'max-w-breakpoint-2xl mx-auto';
  }
}

function shouldEnableGrid(path: string) {
  if (path.startsWith('/projects')) {
    return true;
  }
  switch (path) {
    case '/now':
    case '/research':
    case '/design':
      return true;
    case '/404':
    case '/':
    default:
      return false;
  }
}

function getLayoutClass(path: string) {
  return shouldEnableGrid(path)
    ? 'max-w-breakpoint-2xl mx-auto tablet:grid tablet:grid-cols-8 tablet:gap-x-4'
    : '';
}

export default function SiteHeader({ showTitle = true }: SiteHeaderProps) {
  const [showMore, setShowMore] = useState(false);

  const toggleShowMore = () => {
    setShowMore(!showMore);
  };

  const path = usePathname();
  const width = getWidthCss(path);

  return (
    <header
      className={`print:block ${getLayoutClass(path)} sticky top-0 z-50 px-lg desktop-large:p-0`}
    >
      <nav
        className={`bordered h-[64px] sticky top-4 mt-4 flex align-middle ${width} p-sm tablet:p-lg text-center tablet:text-left items-start tablet:justify-between bg-white dark:bg-slate-900 transition`}
      >
        <div className="flex-grow font-bold font-display text-xl">
          {showTitle && (
            <Link
              href="/"
              className="hover:underline focus:underline underline-offset-4"
            >
              Willie Chalmers III
            </Link>
          )}
        </div>
        <div className="align-middle flex-inline hidden tablet:block print:hidden">
          <ul className="tablet:flex space-x-6">
            <li className="font-bold font-display text-xl">
              <Link
                href="/now"
                className="hover:underline focus:underline underline-offset-4"
              >
                Now
              </Link>
            </li>
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
            <li className="font-bold font-display text-xl">
              <Link
                href="/design"
                className="hover:underline focus:underline underline-offset-4"
              >
                Design
              </Link>
            </li>
            <li className="font-bold font-display text-xl">
              <Link
                href="/resume.pdf"
                className="hover:underline focus:underline underline-offset-4"
              >
                Resume
              </Link>
            </li>
          </ul>
        </div>
        <Menu>
          <Menu.Items className="print:hidden">
            <ul className="md:flex space-x-6 py-2 lg:py-0">
              <Menu.Item>
                <li className="font-bold font-display text-xl">
                  <Link
                    href="/now"
                    className="hover:underline focus:underline underline-offset-4"
                  >
                    Now
                  </Link>
                </li>
              </Menu.Item>
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
              <li className="font-bold font-display text-xl">
                <Link
                  href="/design"
                  className="hover:underline focus:underline underline-offset-4"
                >
                  Design
                </Link>
              </li>
              <li className="font-bold font-display text-xl">
                <Link
                  href="/resume.pdf"
                  className="hover:underline focus:underline underline-offset-4"
                >
                  Resume
                </Link>
              </li>
            </ul>
          </Menu.Items>
          <Menu.Button
            type="button"
            className="print:hidden tablet:hidden rounded-lg text-on-surface-foreground dark:text-on-surface-foreground-dark flex flex-col justify-center cursor-pointer"
            onClick={toggleShowMore}
          >
            <Image src={expandMenuIcon} alt={'See more navigation options'} />
          </Menu.Button>
        </Menu>
      </nav>
    </header>
  );
}

type NavigationItemContents = {
  href: string;
  title: string;
  subitems?: NavigationItemContents[];
};

interface NavigationItemProps extends NavigationItemContents {}

function NavigationItem({ href, title, subitems }: NavigationItemProps) {
  const itemList = subitems?.map((item) => {
    return (
      <li className="font-medium font-display text-lg" key={title + href}>
        <Link
          href={item.href}
          className="hover:underline focus:underline underline-offset-4"
        >
          {item.title}
        </Link>
      </li>
    );
  });

  return (
    <div>
      <div className="font-bold font-display text-xl">
        <Link href={href}>{title}</Link>
      </div>
      {subitems && <ul>{itemList}</ul>}
    </div>
  );
}
