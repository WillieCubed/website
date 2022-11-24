import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Script from 'next/script';

/**
 * A wrapper for website styles and additional site-wide client-side code.
 */
function WebsiteApp({ Component, pageProps }: AppProps) {
  return (
    <div className="min-h-screen">
      {/* <div className="min-h-screen dark:bg-slate-900 dark:text-slate-300"> */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GTAG_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());

          gtag('config', '${process.env.NEXT_PUBLIC_GTAG_ID}');
        `}
      </Script>
      <Component {...pageProps} />
    </div>
  );
}

export default WebsiteApp;
