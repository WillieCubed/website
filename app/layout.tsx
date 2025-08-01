import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Rubik } from 'next/font/google';
import Script from 'next/script';
import type { Metadata, Viewport } from 'next/types';
import React from 'react';

import LayoutWrapper from './LayoutWrapper';
import './globals.css';

const siteFont = Rubik({
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-default',
  display: 'swap',
  subsets: ['latin'],
});
const displayFont = Rubik({
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
  subsets: ['latin'],
});

const BASE_URL =
  process.env.NODE_ENV === 'development'
    ? `http://localhost:${process.env.PORT || 3000}`
    : (process.env.VERCEL_ENV ?? `https://${process.env.VERCEL_URL}`) ||
      'https://williecubed.me';

export const metadata: Metadata = {
  metadataBase: new URL('https://williecubed.me/'),
  title: {
    default: 'Willie Chalmers III',
    template: '%s - Willie Chalmers III',
  },
  description:
    'Willie Chalmers III builds software for humans. Learn more about him and his projects here.',
  openGraph: {
    siteName: 'Wilie Chalmers III',
    url: '/',
    type: 'website',
    images: ['/assets/headshot.jpg'],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3C84FC' },
    { media: '(prefers-color-scheme: dark)', color: '#034ECE' },
  ],
};

export default async function RootLayout({
  children,
}: React.PropsWithChildren) {
  return (
    <html lang="en">
      <head />
      <body
        className={`min-h-screen scrollbar-w-8 scrollbar-track-surface-container bg-surface-container ${siteFont.variable} ${displayFont.variable} font-sans`}
      >
        {process.env.NODE_ENV === 'production' && (
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
        {/* <LayoutWrapper>{children}</LayoutWrapper> */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
