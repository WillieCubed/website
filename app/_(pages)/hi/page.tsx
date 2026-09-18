import type { Metadata } from 'next';

import SiteLink from '@/components/link/SiteLink';

export const metadata: Metadata = {
  title: 'Hello from Willie!',
  description:
    "If you're here, you're probably looking for something in particular.",
};

/**
 * Basically a contact card.
 */
export default function HiPage() {
  return (
    // TODO: Include links to explore website further.
    // TODO: Include social links.
    // TODO: Make this cute.
    <main className="p-8 min-h-[80vh] container mx-auto">
      <SiteLink href="https://instagram.com">
        <div className="text-display-large text-center">!_UwU_!</div>
      </SiteLink>
    </main>
  );
}
