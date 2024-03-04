import { Analytics } from '@vercel/analytics/react';
import React from 'react';
import { Work_Sans } from 'next/font/google';
import Script from 'next/script';
import type { Metadata, Viewport } from 'next/types';
import { randomlyChooseTagline } from '@/lib/enhancements';
import './globals.css';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';

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
  metadataBase: new URL('https://williecubed.me/'),
  title: {
    default: 'Willie Chalmers III',
    template: '%s - Willie Chalmers III',
  },
  description:
    'Willie Chalmers III builds software for people. Learn more about him and his projects here.',
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
  const footerTagline = randomlyChooseTagline();
  // const accessToken = /* await get<string>('spotify_access_token') || */ '';

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
        <>
          <SiteHeader />
          {children}
          <SiteFooter tagline={footerTagline} />
          <Analytics />
        </>
      </body>
    </html>
  );
}
