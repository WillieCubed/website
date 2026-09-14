import Link from 'next/link';

import type { Backlink } from '@/lib/writings/backlinks';

interface BacklinksSectionProps {
  backlinks: Backlink[];
}

export default function BacklinksSection({ backlinks }: BacklinksSectionProps) {
  if (backlinks.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="text-title-medium font-medium text-gray-700 dark:text-gray-300">
        Linked from{' '}
        <span className="text-gray-500 dark:text-gray-400">
          ({backlinks.length})
        </span>
      </h2>
      <div className="space-y-3">
        {backlinks.map((backlink) => (
          <BacklinkCard key={backlink.slug} backlink={backlink} />
        ))}
      </div>
    </section>
  );
}

function BacklinkCard({ backlink }: { backlink: Backlink }) {
  const formattedDate = new Date(backlink.published).toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }
  );

  return (
    <Link
      href={`/writings/${backlink.slug}`}
      className="block rounded-lg border border-gray-200 p-4 transition-all duration-200 ease-out hover:border-gray-300 hover:bg-gray-50 hover:translate-x-1 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800/50"
    >
      <div className="space-y-1">
        <h3 className="text-title-small font-medium text-gray-900 dark:text-gray-100">
          {backlink.title}
        </h3>
        <p className="line-clamp-2 text-body-small text-gray-600 dark:text-gray-400">
          {backlink.excerpt}
        </p>
        <p className="text-label-small text-gray-500 dark:text-gray-500">
          {formattedDate}
        </p>
      </div>
    </Link>
  );
}
