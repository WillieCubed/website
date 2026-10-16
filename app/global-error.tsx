'use client';

import ServerError from '@/components/error/ServerError';

import { site } from '@/lib/site/identity';

import { monoFont, sansFont } from '../components/site/fonts';
import './globals.css';

/**
 * Catches an error in the root layout itself. It replaces that layout, so
 * it brings its own document, fonts, and styles, and sets the title with a
 * React `<title>` because error boundaries cannot export metadata.
 */
interface GlobalErrorProps {
  retry: () => void;
}

export default function GlobalError({ retry }: GlobalErrorProps) {
  return (
    <html
      lang={site.language}
      className={`${sansFont.variable} ${monoFont.variable}`}
    >
      <body className="flex min-h-dvh flex-col bg-ground text-ink font-sans antialiased">
        <title>{`Something went wrong · ${site.name}`}</title>
        <meta name="robots" content="noindex, nofollow" />
        <ServerError onRetry={retry} />
      </body>
    </html>
  );
}
