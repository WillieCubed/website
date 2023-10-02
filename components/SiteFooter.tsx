'use client';

import React from 'react';
import taglines from '../lib/tagline_data.json';
import Link from 'next/link';

/**
 * Generate a random tagline quote.
 */
function randomlyChooseTagline() {
  const count = taglines.length;
  const index = Math.floor(Math.random() * count);
  return taglines[index];
}

/**
 * The site-wide footer with useful links to pages and other websites.
 */
export default function SiteFooter() {
  const [footerTagline, setFooterTagline] = React.useState(taglines[0]);

  React.useEffect(() => {
    setFooterTagline(randomlyChooseTagline);
  }, []);

  return (
    <footer className="bg-white text-on-light dark:bg-slate-900 dark:text-slate-300 border-t-2 border-black dark:border-slate-500/50">
      <div className="space-y-4 lg:space-y-0 md:grid lg:grid-cols-12 md:gap-4 lg:gap-6 py-16 px-4">
        <div
          id="tagline"
          className="text-headline-small pb-12 md:mb-0 lg:text-headline-medium text-center lg:text-left font-display row-start-1 col-start-1 lg:col-start-2 md:col-span-3"
        >
          {footerTagline}
        </div>
        <div className="row-start-2 md:row-start-1 lg:col-span-2 lg:col-start-6">
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
              <li>
                <Link
                  href="/design"
                  className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                >
                  Design
                </Link>
              </li>
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
            </ul>
          </div>
        </div>
        <div className="row-start-2 md:row-start-1 lg:col-span-2">
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
              <li>
                <Link
                  href="https://blog.williecubed.me"
                  className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                >
                  Blog
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="row-start-2 md:row-start-1 lg:col-span-2">
          <div className="text-title-large font-display">Find me elsewhere</div>
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
              <li>
                <a
                  href="https://sigmoid.social/@willie"
                  className="font-display text-title-small dark:text-white opacity-[0.87] hover:opacity-100 dark:hover:text-white"
                  rel="me"
                >
                  Mastodon
                </a>
              </li>
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
      <div
        className="px-4 py-2 text-center text-sm bg-primary-light-1 text-on-primary dark:text-on-dark dark:bg-blue-900 cursor-pointer font-display"
        title="It took nearly half a decade, but it's better than nothing."
      >
        Built with great patience by Willie.
      </div>
    </footer>
  );
}
