'use client';

import Link from 'next/link';
import React from 'react';

import { randomlyChooseTagline } from '@/lib/enhancements';

// import { REMOTE_CONFIG_KEYS, fetchConfig } from '@/lib/config';

// import NowPlayingWidget from './widgets/NowPlayingWidget';

interface SiteFooterProps {
  /**
   * The tagline to display.
   */
  tagline: string;
  // spotifyAccessToken: string;
}

const QUICK_LINKS: { label: string; href: string }[] = [
  {
    label: '/now',
    href: '/now',
  },
  // {
  //   label: '/mission',
  //   href: '/mission',
  // },
  {
    label: '/diary',
    href: 'https://youtube.com/@williecubed?si=AUjppFRsOQ0e7iJy',
  },
  // {
  //   label: '/projects',
  //   href: '/projects',
  // },
  {
    label: '/colophon',
    href: '/colophon',
  },
];

/**
 * The site-wide footer with useful links to pages and other websites.
 */
export default function SiteFooter(
  {
    // tagline,
    // spotifyAccessToken: accessToken,
  }: SiteFooterProps
) {
  const tagline = randomlyChooseTagline();
  // const showWritings = await fetchConfig(REMOTE_CONFIG_KEYS.showWritings);
  return (
    <footer className="bg-surface-container-highest text-on-surface border-t border-outline">
      <div className="max-w-breakpoint-2xl mx-auto space-y-lg tablet:space-y-0 tablet:grid desktop:grid-cols-8 tablet:px-lg py-16 print:py-lg px-lg gap-x-lg">
        <div className="row-start-1 col-start-1 desktop:col-start-1 tablet:col-span-3 h-full space-y-lg">
          <div className="text-center tablet:text-start text-display-small tablet:text-display-medium text-primary">
            Willie Chalmers III
          </div>
          <div
            id="tagline"
            className="text-headline-small desktop:text-headline-medium text-center tablet:text-left font-display"
          >
            {tagline}
          </div>
          {/* <div className="-mx-md flex flex-col tablet:flex-row tablet:space-x-sm space-y-sm tablet:space-y-0 items-center">
            <div className="px-md py-sm text-title-medium text-on-surface-variant hover:interactive-bg-surface-container rounded-full">@blog@williecubed.me</div>
            <Link className="px-md py-sm text-title-medium text-on-surface-variant hover:interactive-bg-surface-container focus:interactive-bg-surface-container rounded-full" href="/rss">willieubed.me/rss</Link>
          </div> */}
          <div className="print:hidden flex justify-center">
            {/* <NowPlayingWidget accessToken={accessToken} /> */}
          </div>
        </div>
        <div className="print:hidden row-start-2 desktop:row-start-1 tablet:col-span-4 desktop:col-span-5 space-y-2xl">
          <div className="w-full space-y-sm flex flex-col *:inline-flex *:justify-end">
            <div className="text-label-large">Quick links</div>
            <div className="space-x-xl">
              {QUICK_LINKS.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="text-title-medium lg:text-title-large text-primary hover:font-bold transition-all ease-in-out"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          {/* <div className="tablet:flex">
            <div className="flex-1 mt-lg tablet:mt-0 text-end">
              <div className="text-label-large text-on-surface-variant font-display">My Work</div>
              <div className="mt-lg">
                <ul className="space-y-sm">
                  <li>
                    <Link
                      href="/projects"
                      className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                    >
                      Projects & Apps
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/research"
                      className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                    >
                      Research
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/media"
                      className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                    >
                      Media
                    </Link>
                  </li>
                  {showWritings && (
                    <li>
                      <Link
                        href="/writings"
                        className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                      >
                        Writings
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
            </div>
            <div className="flex-1 mt-lg tablet:mt-0 text-end">
              <div className="text-label-large text-on-surface-variant font-display">Myself</div>
              <div className="mt-lg">
                <ul className="space-y-sm">
                  <li>
                    <Link
                      href="/now"
                      className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                    >
                      About
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/resume.pdf"
                      className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                    >
                      Resume
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/writings"
                      className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                    >
                      Writings (Blog)
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="https://blog.williecubed.me"
                      className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                    >
                      Blog
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="flex-1 mt-lg tablet:mt-0 text-end">
              <div className="text-label-large text-on-surface-variant font-display">Core Initiatives</div>
              <div className="mt-lg">
                <ul className="space-y-sm">
                  <li>
                    <Link
                      href="https://logdate.app"
                      className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                    >
                      LogDate
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="https://diaries.williecubed.me"
                      className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                    >
                      The Willie Diaries
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/media/overthinking-everything"
                      className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                    >
                      Overthinking Everything
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/research/aggie"
                      className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                    >
                      The AGI Project
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div> */}
          <div className="flex-1 mt-lg tablet:mt-0 text-end">
            <div className="text-label-large text-on-surface-variant font-display">
              Find me elsewhere
            </div>
            <div className="mt-lg">
              <ul className="space-y-sm tablet:space-y-0 *:tablet:inline-flex tablet:space-x-lg">
                <li>
                  <a
                    href="https://threads.net/@williecubed"
                    className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 hover:underline dark:hover:text-white"
                    rel="me"
                  >
                    Threads
                  </a>
                </li>
                <li>
                  <a
                    href="https://instagram.com/williecubed"
                    className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 hover:underline dark:hover:text-white"
                  >
                    Instagram
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/WillieCubed"
                    className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 hover:underline dark:hover:text-white"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.linkedin.com/in/willie-chalmers-iii"
                    className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 hover:underline dark:hover:text-white"
                  >
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.last.fm/user/WillieCubed"
                    className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 hover:underline dark:hover:text-white"
                  >
                    Last.fm
                  </a>
                </li>
                <li>
                  <a
                    href="https://open.spotify.com/user/pkj37ts4e7ip19j0msai6lahf?si=f5ef7fee59a24015"
                    className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 hover:underline dark:hover:text-white"
                  >
                    Spotify
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:hello@williecubed.me?subject=Hello%20Willie!"
                    className="font-display text-title-medium dark:text-white opacity-[0.87] hover:opacity-100 hover:underline dark:hover:text-white"
                  >
                    Email
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
