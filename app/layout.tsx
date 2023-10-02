import React from 'react';
import { Work_Sans } from 'next/font/google';
import './globals.css';
import Script from 'next/script';
import type { Metadata } from 'next/types';

const siteFont = Work_Sans({
  weight: ['500', '600', '700'],
  variable: '--font-default',
  display: 'auto',
  subsets: ['latin'],
});

const BASE_URL =
  process.env.NODE_ENV === 'development'
    ? `http://localhost:${process.env.PORT || 3000}`
    : (process.env.VERCEL_ENV ?? `https://${process.env.VERCEL_URL}`) ||
    'https://williecubed.me';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Willie Chalmers III',
    template: '%s - Willie Chalmers III',
  },
  description:
    'Willie Chalmers III is a recent graduate of computer science from The University of Texas at Dallas. Learn more about him and his projects here.',
  openGraph: {
    siteName: 'Wilie Chalmers III',
    url: '/',
    type: 'website',
    images: ['/assets/headshot.jpg'],
  },
};

export default function RootLayout({ children }: React.PropsWithChildren) {
  return (
    <html lang="en">
      <head />
      <body className={`min-h-screen scrollbar-thin ${siteFont.className}`}>
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
      </body>
    </html>
  );
}
