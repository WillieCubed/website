import type { NextPage } from "next";
import Head from "next/head";

const LandingPage: NextPage = () => {
  return (
    <div>
      <Head>
        <title>Willie Chalmers III</title>
        <meta
          name="description"
          content="Everything WillieCubed. See what projects he's working on."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <section></section>
      </main>

      <footer className="bg-slate-200 dark:bg-slate-900 dark:text-slate-300">
        <div className="mx-auto max-w-6xl lg:grid lg:gap-4 pt-4 pb-8 px-4 lg:grid-cols-3">
          <div>
            <div className="my-2 font-bold font-display text-md dark:text-white">
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
            </ul>
          </div>
          <div>{/* Placeholder */}</div>
          <div>
            <div className="my-2 font-bold font-display text-md dark:text-white">
              Find me elsewhere
            </div>
            <ul>
              <li className="hover:text-emerald-400">
                <a
                  className="font-normal"
                  href="https://github.com/WillieCubed"
                >
                  GitHub (@WillieCubed)
                </a>
              </li>
              <li className="hover:text-emerald-400">
                <a
                  className="font-normal"
                  href="https://twitter.com/WillieCubed"
                >
                  Twitter (@WillieCubed)
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
          className="p-4 text-center text-sm bg-blue-100 dark:bg-blue-900 dark:text-white cursor-pointer"
          title="It took nearly half a decade, but it's better than nothing."
        >
          Built with great patience by Willie.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
