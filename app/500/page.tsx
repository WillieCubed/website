import type { Metadata } from 'next';

import SiteLink from '@/components/link/SiteLink';

export const metadata: Metadata = {
  title: 'Something went wrong',
  robots: {
    index: false,
    follow: false,
  },
};

export default function ServerErrorPage() {
  return (
    <main className="mx-auto min-h-[80vh] max-w-breakpoint-lg space-y-lg px-lg py-16">
      <h1 className="font-display text-display-large">Something went wrong.</h1>
      <p className="text-headline-small text-on-surface">
        The site hit a server error.
      </p>
      <SiteLink href="/" className="text-primary text-title-large">
        Return Home
      </SiteLink>
    </main>
  );
}
