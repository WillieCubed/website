import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import {
  Atkinson_Hyperlegible_Mono,
  Atkinson_Hyperlegible_Next,
} from 'next/font/google';
import Script from 'next/script';
import type { Metadata, Viewport } from 'next/types';
import React from 'react';

import { site } from '@/lib/site';
import { HIATUS_MESSAGE, isHiatusMode } from '@/lib/site-mode';

import './globals.css';

const sansFont = Atkinson_Hyperlegible_Next({
  variable: '--font-atkinson',
  display: 'swap',
  subsets: ['latin'],
});
const monoFont = Atkinson_Hyperlegible_Mono({
  variable: '--font-atkinson-mono',
  display: 'swap',
  subsets: ['latin'],
});

const isHiatus = isHiatusMode();

export const metadata: Metadata = isHiatus
  ? {
      metadataBase: new URL(site.origin),
      title: {
        absolute: HIATUS_MESSAGE,
      },
      description: HIATUS_MESSAGE,
      openGraph: {
        title: HIATUS_MESSAGE,
        description: HIATUS_MESSAGE,
        url: '/',
        type: 'website',
      },
      robots: {
        index: false,
        follow: false,
        nocache: true,
      },
    }
  : {
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
        images: [site.ogImage],
      },
      twitter: {
        card: 'summary_large_image',
      },
    };

export const viewport: Viewport = {
  themeColor: site.themeColor,
};

export default async function RootLayout({
  children,
}: React.PropsWithChildren) {
  return (
    <html lang={site.language}>
      <head />
      <body
        className={`min-h-screen scrollbar-w-8 scrollbar-track-surface-container bg-ground text-ink ${sansFont.variable} ${monoFont.variable} font-sans antialiased`}
      >
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
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
