import WebmentionSection from '@/components/indieweb/WebmentionSection';

import type { WebmentionGroup } from '@/lib/indieweb/types';
import type { Backlink } from '@/lib/writings/backlinks';

import BacklinksSection from './BacklinksSection';

interface PostInteractionsProps {
  webmentions: WebmentionGroup | null;
  backlinks: Backlink[];
  slug: string;
}

export default function PostInteractions({
  webmentions,
  backlinks,
}: PostInteractionsProps) {
  const hasWebmentions =
    webmentions &&
    (webmentions.likes.length > 0 ||
      webmentions.reposts.length > 0 ||
      webmentions.replies.length > 0 ||
      webmentions.mentions.length > 0 ||
      webmentions.bookmarks.length > 0);

  const hasBacklinks = backlinks.length > 0;

  // Don't render if there's nothing to show
  if (!hasWebmentions && !hasBacklinks) {
    return (
      <section className="mx-auto max-w-breakpoint-md border-t border-gray-200 px-lg pt-8 dark:border-gray-700 desktop:px-0">
        <WebmentionCTA />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-breakpoint-md space-y-8 border-t border-gray-200 px-lg pt-8 dark:border-gray-700 desktop:px-0">
      {/* Webmentions */}
      {hasWebmentions && webmentions && (
        <WebmentionSection webmentions={webmentions} />
      )}

      {/* Backlinks */}
      <BacklinksSection backlinks={backlinks} />

      {/* Webmention CTA - always show */}
      {!hasWebmentions && <WebmentionCTA />}
    </section>
  );
}

function WebmentionCTA() {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
      <p className="text-body-medium text-gray-600 dark:text-gray-400">
        Have you written a response? Let me know by sending a{' '}
        <a
          href="https://indieweb.org/Webmention"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Webmention
        </a>
        .
      </p>
    </div>
  );
}
