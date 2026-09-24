import Icon from '@/components/icons/Icon';
import ThreadsIcon from '@/components/icons/ThreadsIcon';
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
    <section className="space-y-10 pt-10">
      <SiteLink
        href={threadsPostIntent(writing, target)}
        target="_blank"
        className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-label-large font-medium text-ink no-underline transition-colors hover:border-accent hover:bg-tray"
      >
        <ThreadsIcon className="size-4" />
        Share on Threads
      </SiteLink>
      {hasWebmentions && webmentions && (
        <WebmentionSection webmentions={webmentions} />
      )}
      {backlinks.length > 0 && <BacklinksSection backlinks={backlinks} />}
      <details className="group rounded-3xl bg-surface-container">
        <summary className="flex cursor-pointer list-none items-center gap-4 rounded-3xl px-6 py-5 medium:px-8 [&::-webkit-details-marker]:hidden">
          <span className="rounded-full bg-card p-2 text-ink">
            <Icon name="reply" size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-title-medium font-semibold text-ink">
              Reply from your site
            </span>
            <span className="block text-body-small text-muted">
              Submit a published reply URL
            </span>
          </span>
          <Icon
            name="arrow-right"
            size={18}
            className="shrink-0 transition-transform group-open:rotate-90"
          />
        </summary>
        <div className="px-6 pb-6 pt-1 medium:px-8">
          <WebmentionForm target={target} />
        </div>
      </details>
    </section>
  );
}
