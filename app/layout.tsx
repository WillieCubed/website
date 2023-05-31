import React from 'react';
import { Roboto, Work_Sans } from 'next/font/google';
import './globals.css';
import Script from 'next/script';
import type { Metadata } from 'next/types';

const sansFont = Roboto({
  weight: ['500', '700'],
  variable: '--font-sans',
  display: 'auto',
  subsets: ['latin'],
});

const displayFont = Work_Sans({
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'auto',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Willie Chalmers III',
    template: '%s - Willie Chalmers III',
  },
  openGraph: {
    siteName: 'Wilie Chalmers III',
    url: '/',
    type: 'website',
    images: ['/assets/headshot.jpg'],
  },
};

export default function RootLayout({ children }: React.PropsWithChildren) {
  return (
    <html lang="en" className={`${sansFont.variable} ${displayFont.variable}`}>
      <head />
      <body className={'min-h-screen scrollbar-thin '}>
        {process.env.NODE_ENV === 'production' && (
          <>
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
          </>
        )}
        {children}
      </body>
    </html>
  );
}
