'use client';

import clsx from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import expandMenuIcon from '../app/assets/read_more.svg';

interface SiteHeaderProps {
  /**
   * A flag to show the name link back to the home page.
   */
  showTitle?: boolean;
}

function getWidthCss(path: string) {
  if (path === '/projects') {
    return 'tablet:col-start-2 tablet:col-span-6';
  }
  if (path.startsWith('/projects/')) {
    return 'tablet:col-start-1 tablet:col-span-8';
  }
  if (path === '/writings') {
    return 'tablet:col-start-2 tablet:col-span-6';
  }
  if (path.startsWith('/writings/')) {
    return 'tablet:col-start-1 tablet:col-span-8';
  }
  switch (path) {
    case '/now':
      return 'tablet:col-start-2 tablet:col-span-6';
    case '/design':
    case '/research':
      return 'tablet:col-start-2 tablet:col-span-6';
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
  if (path.startsWith('/writings')) {
    return true;
  }
  switch (path) {
    case '/writings':
    case '/research':
    case '/design':
    case '/now':
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
      className={clsx(
        'print:block sticky top-lg z-50 px-lg desktop-large:p-0',
        getLayoutClass(path)
      )}
    >
      <nav
        className={clsx(
          'bordered min-h-[64px] sticky top-lg flex align-middle p-sm tablet:p-lg tablet:text-left items-start justify-between bg-surface-foreground dark:bg-surface-foreground-dark transition-all ease-in-out duration-300',
          width
        )}
      >
        <div className="h-full w-full flex-col justify-center pt-sm tablet:pt-0 tablet:flex tablet:flex-row tablet:justify-between items-center">
          <div className="flex-grow font-bold font-display text-xl px-sm tablet:px-0">
            {showTitle && (
              <Link
                href="/"
                className="hover:underline focus:underline underline-offset-4"
              >
                Willie Chalmers III
              </Link>
            )}
          </div>
          <div
            className={clsx(
              'align-middle tablet:flex-inline print:hidden',
              showMore ? 'block' : 'hidden tablet:block'
            )}
          >
            <ul className="py-sm px-sm tablet:p-0 tablet:flex tablet:space-x-xl *:text-left">
              <li className="font-bold font-display text-xl">
                <Link
                  href="/now"
                  className={clsx(
                    'hover:underline focus:underline underline-offset-4'
                  )}
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
              {/* TODO: Re-enable design once it's ready */}
              {/* <li className="font-bold font-display text-xl">
                <Link
                  href="/design"
                  className="hover:underline focus:underline underline-offset-4"
                >
                  Design
                </Link>
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
          </div>
        </div>
        <button
          type="button"
          className="size-[40px] print:hidden tablet:hidden rounded-lg text-on-surface-foreground dark:text-on-surface-foreground-dark flex flex-col justify-center items-center cursor-pointer"
          onClick={toggleShowMore}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-description={
              showMore
                ? 'Hide more navigation options'
                : 'See more navigation options'
            }
          >
            <mask
              id="mask0_1239_718"
              style={{ maskType: 'alpha' }}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="24"
              height="24"
            >
              <rect width="24" height="24" fill="#D9D9D9" />
            </mask>
            <g mask="url(#mask0_1239_718)">
              <path
                d="M7.45 17.4498L6.05 16.0498L9.075 12.9998H2V10.9998H9.075L6.05 7.9498L7.45 6.5498L12.9 11.9998L7.45 17.4498ZM13 16.9998V14.9998H22V16.9998H13ZM13 8.9998V6.9998H22V8.9998H13ZM16 12.9998V10.9998H22V12.9998H16Z"
                fill="currentColor"
              />
            </g>
          </svg>
        </button>
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
