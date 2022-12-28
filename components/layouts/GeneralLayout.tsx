import React from 'react';
import SiteFooter from '../SiteFooter';
import SiteHeader from '../SiteHeader';

export default function GeneralLayout({ children }: React.PropsWithChildren) {
  {/* TODO: Figure out how to intelligently hide header on / load */ }
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}