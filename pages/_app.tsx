import "../styles/globals.css";
import type { AppProps } from "next/app";

/**
 * A wrapper for website styles and additional site-wide client-side code.
 */
function WebsiteApp({ Component, pageProps }: AppProps) {
  return (
    <div className="min-h-screen dark:bg-slate-900 dark:text-slate-300">
      <Component {...pageProps} />
    </div>
  );
}

export default WebsiteApp;
