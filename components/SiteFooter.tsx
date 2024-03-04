import React from 'react';
import Link from 'next/link';
import { REMOTE_CONFIG_KEYS, fetchConfig } from '@/lib/config';
// import NowPlayingWidget from './widgets/NowPlayingWidget';

interface SiteFooterProps {
  /**
   * The tagline to display.
   */
  tagline: string;
  // spotifyAccessToken: string;
}

/**
 * The site-wide footer with useful links to pages and other websites.
 */
export default async function SiteFooter({
  tagline,
  // spotifyAccessToken: accessToken,
}: SiteFooterProps) {
  const showWritings = await fetchConfig(REMOTE_CONFIG_KEYS.showWritings);
  return (
    <footer className="bg-white text-on-light dark:bg-slate-900 dark:text-slate-300 bordered-t">
      <div className="max-w-breakpoint-2xl mx-auto space-y-lg tablet:space-y-0 tablet:grid desktop:grid-cols-8 tablet:px-lg py-16 print:py-lg px-lg gap-x-lg">
        <div className="row-start-1 col-start-1 desktop:col-start-1 tablet:col-span-3 h-full flex flex-col justify-between">
          <div
            id="tagline"
            className="text-headline-small pb-12 print:pb-0 tablet:mb-0 desktop:text-headline-medium text-center tablet:text-left font-display"
          >
            {tagline}
          </div>
          <div className="print:hidden flex justify-center">
            {/* <NowPlayingWidget accessToken={accessToken} /> */}
          </div>
        </div>
        <div className="print:hidden tablet:flex row-start-2 desktop:row-start-1 tablet:col-span-4 desktop:col-span-5">
          <div className="flex-1 mt-lg tablet:mt-0">
            <div className="text-title-large font-display">My Work</div>
            <div className="mt-4">
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/projects"
                    className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                  >
                    Technical Projects
                  </Link>
                </li>
                {/* TODO: Re-enable design once it's ready */}
                {/* <li>
                  <Link
                    href="/design"
                    className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                  >
                    Design
                  </Link>
                </li> */}
                <li>
                  <Link
                    href="/research"
                    className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                  >
                    Research
                  </Link>
                </li>
                <li>
                  <Link
                    href="/media"
                    className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                  >
                    Media
                  </Link>
                </li>
                {showWritings && (
                  <li>
                    <Link
                      href="/writings"
                      className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                    >
                      Writings
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
          <div className="flex-1 mt-lg tablet:mt-0">
            <div className="text-title-large font-display">About Me</div>
            <div className="mt-4">
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/now"
                    className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                  >
                    Current stuff
                  </Link>
                </li>
                <li>
                  <Link
                    href="/resume.pdf"
                    className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                  >
                    Resume
                  </Link>
                </li>
                <li>
                  <Link
                    href="/bio"
                    className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                  >
                    Bio
                  </Link>
                </li>
                {/* TODO: Re-add blog link when ready */}
                {/* <li>
                  <Link
                    href="https://blog.williecubed.me"
                    className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                  >
                    Blog
                  </Link>
                </li> */}
                {/* TODO: Introduce colophon page when ready */}
                {/* <li>
                  <Link
                    href="/colophon"
                    className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                  >
                    Colophon
                  </Link>
                </li> */}
              </ul>
            </div>
          </div>
          <div className="flex-1 mt-lg tablet:mt-0">
            <div className="text-title-large font-display">
              Find me elsewhere
            </div>
            <div className="mt-4">
              <ul className="space-y-2">
                <li>
                  <a
                    href="https://threads.net/@williecubed"
                    className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                    rel="me"
                  >
                    Threads
                  </a>
                </li>
                {/* TODO: Reevaluate Mastodon */}
                {/* <li>
                <a
                  href="https://sigmoid.social/@willie"
                  className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                  rel="me"
                >
                  Mastodon
                </a>
              </li> */}
                <li>
                  <a
                    href="https://instagram.com/williecubed"
                    className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                  >
                    Instagram
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/WillieCubed"
                    className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.linkedin.com/in/willie-chalmers-iii"
                    className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                  >
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.last.fm/user/WillieCubed"
                    className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                  >
                    Last.fm
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:hello@williecubed.me?subject=Hello%20Willie!"
                    className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
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
