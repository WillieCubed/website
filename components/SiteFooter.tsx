'use client';

import React from 'react';
import taglines from '../lib/tagline_data.json';

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
    <footer className="bg-primary-dark-1 text-on-dark dark:bg-slate-900 dark:text-slate-300 dark:border-t-2 dark:border-slate-500/50">
      <div className="mx-auto max-w-6xl lg:grid lg:gap-4 pt-4 pb-8 px-4 lg:grid-cols-4">
        <div
          id="quote"
          className="mt-2 mb-4 md:px-4 text-xl text-center md:text-left font-display lg:col-span-2"
        >
          {footerTagline}
        </div>
        <div>{/* TODO: Put other personal tools here */}</div>
        <div>
          <div className="my-2 font-bold font-display text-md dark:text-white">
            Find me elsewhere
          </div>
          <ul>
            <li>
              <a
                className="font-normal text-white opacity-[0.87] hover:opacity-100 hover:text-white"
                href="https://github.com/WillieCubed"
              >
                GitHub (@WillieCubed)
              </a>
            </li>
            <li>
              <a
                className="font-normal text-white opacity-[0.87] hover:opacity-100 hover:text-white"
                href="https://twitter.com/WillieCubed"
              >
                Twitter (@WillieCubed)
              </a>
            </li>
            <li>
              <a
                className="font-normal text-white opacity-[0.87] hover:opacity-100 hover:text-white"
                href="https://sigmoid.social/@willie"
                rel="me"
              >
                Mastodon (@willie@sigmoid.social)
              </a>
            </li>
            <li className="hover:text-emerald-400">
              <a
                className="font-normal text-white opacity-[0.87] hover:opacity-100 hover:text-white"
                href="https://instagram.com/williecubed"
              >
                Instagram (@williecubed)
              </a>
            </li>
            <li className="hover:text-emerald-400">
              <a
                className="font-normal text-white opacity-[0.87] hover:opacity-100 hover:text-white"
                href="https://linked.com/in/willie-chalmers-iii"
              >
                LinkedIn (Willie Chalmers III)
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div
        className="px-4 py-2 text-center text-sm bg-primary-dark-2 text-on-dark dark:bg-blue-900 dark:text-white cursor-pointer font-display"
        title="It took nearly half a decade, but it's better than nothing."
      >
        Built with great patience by Willie.
      </div>
    </footer>
  );
}
