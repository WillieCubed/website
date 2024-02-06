import React from 'react';
import SiteFooter from '../SiteFooter';
import SiteHeader from '../SiteHeader';

export default function GeneralLayout({
  children,
  tagline,
  // accessToken: spotifyAccessToken,
}: React.PropsWithChildren<{
  // accessToken: string;
  tagline: string;
}>) {
  {
    /* TODO: Figure out how to intelligently hide header on / load */
  }
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter tagline={tagline} />
    </>
  );
}
