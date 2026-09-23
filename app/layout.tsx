import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import Script from 'next/script';
import type { Metadata, Viewport } from 'next/types';
import React from 'react';

import SearchModal from '@/components/search/SearchModal';
import SiteFooter from '@/components/site/SiteFooter';
import SkipLink from '@/components/site/SkipLink';

import {
  INDIEAUTH_AUTHORIZATION_ENDPOINT,
  INDIEAUTH_TOKEN_ENDPOINT,
  MICROPUB_ENDPOINT,
  WEBMENTION_ENDPOINT,
  WEBSUB_HUB,
} from '@/lib/indieweb/constants';
import { site } from '@/lib/site';
import { themeTransitionScript } from '@/lib/theme-transition';

import { monoFont, sansFont } from './fonts';
import './globals.css';

/** Google shows the favicon in results only when it is a multiple of 48px. */
const SITE_ICONS: Metadata['icons'] = {
  icon: [
    { url: '/brand/web/icon-48.png', sizes: '48x48', type: 'image/png' },
    { url: '/icon.svg', type: 'image/svg+xml' },
  ],
  apple: '/apple-touch-icon.png',
};
const SITE_MANIFEST = '/manifest.webmanifest';

export const metadata: Metadata = {
  metadataBase: new URL(site.origin),
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  description: site.description,
  openGraph: {
    siteName: site.name,
    locale: site.locale,
    type: 'website',
    images: [
      {
        url: site.ogImage,
        width: 1200,
        height: 630,
        alt: site.shortDescription,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
  },
  icons: SITE_ICONS,
  manifest: SITE_MANIFEST,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    {
      media: '(prefers-color-scheme: light)',
      color: site.themeColors.light,
    },
    {
      media: '(prefers-color-scheme: dark)',
      color: site.themeColors.dark,
    },
  ],
};

export default async function RootLayout({
  children,
}: React.PropsWithChildren) {
  return (
    // The font variables live on <html>: the theme's --font-sans reads
    // --font-atkinson at :root, and a custom property that references an
    // undefined variable there computes to nothing.
    <html
      lang={site.language}
      className={`${sansFont.variable} ${monoFont.variable}`}
    >
      <head>
        <script
          id="theme-transition"
          dangerouslySetInnerHTML={{ __html: themeTransitionScript }}
        />
        {/* IndieWeb discovery: where to send mentions and posts, who vouches
            for this site, and where the feeds live. */}
        <link rel="author" href={`${site.origin}/`} />
        <link rel="webmention" href={WEBMENTION_ENDPOINT} />
        <link rel="micropub" href={MICROPUB_ENDPOINT} />
        <link
          rel="authorization_endpoint"
          href={INDIEAUTH_AUTHORIZATION_ENDPOINT}
        />
        <link rel="token_endpoint" href={INDIEAUTH_TOKEN_ENDPOINT} />
        <link rel="hub" href={WEBSUB_HUB} />
        <link rel="self" href={site.origin} />
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${site.name} (RSS)`}
          href="/feed.xml"
        />
        <link
          rel="alternate"
          type="application/atom+xml"
          title={`${site.name} (Atom)`}
          href="/feed/atom"
        />
        <link
          rel="alternate"
          type="application/feed+json"
          title={`${site.name} (JSON Feed)`}
          href="/feed/json"
        />
        {/* Lets a browser offer this site as a search engine in its address bar. */}
        <link
          rel="search"
          type="application/opensearchdescription+xml"
          title={site.shortName}
          href="/opensearch.xml"
        />
      </head>
      <body className="flex min-h-dvh flex-col scrollbar-w-8 scrollbar-track-surface-container bg-ground text-ink font-sans antialiased">
        <SkipLink />
        {process.env.NODE_ENV === 'production' &&
          process.env.NEXT_PUBLIC_GTAG_ID && (
            <>
              <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GTAG_ID}`}
                strategy="afterInteractive"
              />
              <Script id="google-analytics" strategy="afterInteractive">
                {`
                window.dataLayer = window.dataLayer || [];
                function gtag() { dataLayer.push(arguments); }
                gtag('js', new Date());
                gtag('config', '${process.env.NEXT_PUBLIC_GTAG_ID}');
              `}
              </Script>
            </>
          )}
        {/* Grows to fill a short page so the footer rests on the bottom of
            the window instead of riding up under the content. */}
        <div className="grow">{children}</div>
        <SiteFooter />
        <SearchModal />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
