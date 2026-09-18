import { Metadata } from 'next';

import SiteLink from '@/components/link/SiteLink';

export const metadata: Metadata = {
  title: "That's a 404!",
  openGraph: {
    title: 'Not Found',
    description:
      "If you're seeing this, you've found a broken link. Sorry about that!",
    type: 'website',
  },
};

/**
 * The 404 page for the site.
 */
export default function NotFound() {
  return (
    <div className="p-lg pb-2xl desktop:pb-[128px] min-h-[80vh]">
      <main className="max-w-breakpoint-lg mx-auto px-lg py-16 space-y-4">
        <h2 className="text-display-large">Whoops!</h2>
        <div className="text-headline-small">
          Couldn&apos;t find what you were looking for. The link you found was
          invalid or does not exist.
        </div>
        <div>
          <SiteLink href="/" className="text-primary text-title-large">
            Return Home
          </SiteLink>
        </div>
      </main>
    </div>
  );
}
