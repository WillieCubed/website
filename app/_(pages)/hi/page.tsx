import type { Metadata } from 'next';
import Link from 'next/link';

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
      <Link href="https://instagram.com">
        <div className="text-display-large text-center">!_UwU_!</div>
      </Link>
    </main>
  );
}
