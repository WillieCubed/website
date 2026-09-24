import Icon from '@/components/icons/Icon';
import WebmentionForm from '@/components/indieweb/WebmentionForm';
import WebmentionSection from '@/components/indieweb/WebmentionSection';
import SiteLink from '@/components/link/SiteLink';

import { threadsPostIntent } from '@/lib/indieweb/posse';
import type { WebmentionGroup } from '@/lib/indieweb/types';
import type { Backlink } from '@/lib/writings/backlinks';
import type { WritingData } from '@/lib/writings/types';

import BacklinksSection from './BacklinksSection';

interface PostInteractionsProps {
  webmentions: WebmentionGroup | null;
  backlinks: Backlink[];
  slug: string;
  /** The page's canonical URL, the target a reply points at. */
  target: string;
  writing: WritingData;
}

export default function PostInteractions({
  webmentions,
  backlinks,
  target,
  writing,
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
      <SiteLink
        href={threadsPostIntent(writing, target)}
        target="_blank"
        className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-label-large font-medium text-ink no-underline transition-colors hover:border-accent hover:bg-tray"
      >
        Share on Threads
        <Icon name="external" size={14} />
      </SiteLink>
      {hasWebmentions && webmentions && (
        <WebmentionSection webmentions={webmentions} />
      )}
      {backlinks.length > 0 && <BacklinksSection backlinks={backlinks} />}
      <WebmentionForm target={target} />
    </section>
  );
}
