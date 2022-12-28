import React from 'react';
import { Roboto, Work_Sans } from '@next/font/google';
import '../globals.css';
import DashboardLayout from '../../components/layouts/DashboardLayout';

const sansFont = Roboto({
  weight: ['500', '700'],
  variable: '--font-sans',
});

const displayFont = Work_Sans({
  weight: ['500', '600', '700'],
  variable: '--font-display',
});

export default function InternalLayout({ children }: React.PropsWithChildren) {
  return (
    <html lang="en" className={`${sansFont.variable} ${displayFont.variable}`}>
      <head />
      <body className={"min-h-screen bg-light text-on-light dark:bg-slate-900 dark:text-on-dark"}>
        <DashboardLayout>
          {children}
        </DashboardLayout>
      </body>
    </html >
  );
}
