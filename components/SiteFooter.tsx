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
  const footerTagline = randomlyChooseTagline();

  return (
    <footer className="bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-t-2 dark:border-slate-500/50">
      <div className="mx-auto max-w-6xl lg:grid lg:gap-4 pt-4 pb-8 px-4 lg:grid-cols-4">
        <div
          id="quote"
          className="mt-2 mb-4 md:px-4 text-xl text-center md:text-left font-display lg:col-span-2"
        >
          {footerTagline}
        </div>
        <div>
          {/* <div className="my-2 font-bold font-display text-md dark:text-white">
            Personal Tools
          </div>
          <ul>
            <li className="hover:text-emerald-400">
              <a href="https://blog.williecubed.me">Personal Blog</a>
            </li>
            <li className="hover:text-emerald-400">
              <a href="https://goals.williecubed.me">Goals</a>
            </li>
            <li className="hover:text-emerald-400">
              <a href="https://questions.williecubed.me">Questions Tracker</a>
            </li>
            <li className="hover:text-emerald-400">
              <a href="https://links.williecubed.dev">Link Shortener</a>
            </li>
          </ul> */}
        </div>
        <div>
          <div className="my-2 font-bold font-display text-md dark:text-white">
            Find me elsewhere
          </div>
          <ul>
            <li className="hover:text-emerald-400">
              <a className="font-normal" href="https://github.com/WillieCubed">
                GitHub (@WillieCubed)
              </a>
            </li>
            <li className="hover:text-emerald-400">
              <a className="font-normal" href="https://twitter.com/WillieCubed">
                Twitter (@WillieCubed)
              </a>
            </li>
            <li className="hover:text-emerald-400">
              <a
                className="font-normal"
                href="https://sigmoid.social/@willie"
                rel="me"
              >
                Mastodon (@willie@sigmoid.social)
              </a>
            </li>
            <li className="hover:text-emerald-400">
              <a
                className="font-normal"
                href="https://instagram.com/williecubed"
              >
                Instagram (@williecubed)
              </a>
            </li>
            <li className="hover:text-emerald-400">
              <a
                className="font-normal"
                href="https://linked.com/in/willie-chalmers-iii"
              >
                LinkedIn (Willie Chalmers III)
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div
        className="px-4 py-2 text-center text-sm bg-blue-100 dark:bg-blue-900 dark:text-white cursor-pointer font-display"
        title="It took nearly half a decade, but it's better than nothing."
      >
        Built with great patience by Willie.
      </div>
    </footer>
  );
}
