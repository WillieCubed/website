import WebmentionForm from '@/components/indieweb/WebmentionForm';
import WebmentionSection from '@/components/indieweb/WebmentionSection';

import type { WebmentionGroup } from '@/lib/indieweb/types';
import type { Backlink } from '@/lib/writings/backlinks';

import BacklinksSection from './BacklinksSection';

interface PostInteractionsProps {
  webmentions: WebmentionGroup | null;
  backlinks: Backlink[];
  slug: string;
  /** The page's canonical URL, the target a reply points at. */
  target: string;
}

export default function PostInteractions({
  webmentions,
  backlinks,
  target,
}: PostInteractionsProps) {
  const hasWebmentions =
    webmentions &&
    (webmentions.likes.length > 0 ||
      webmentions.reposts.length > 0 ||
      webmentions.replies.length > 0 ||
      webmentions.mentions.length > 0 ||
      webmentions.bookmarks.length > 0);

  return (
    <section className="space-y-10 pt-12">
      {hasWebmentions && webmentions && (
        <WebmentionSection webmentions={webmentions} />
      )}
      {backlinks.length > 0 && <BacklinksSection backlinks={backlinks} />}
      <WebmentionForm target={target} />
    </section>
  );
}
