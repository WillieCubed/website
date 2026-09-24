import WebmentionSection from '@/components/indieweb/WebmentionSection';

import { threadsPostIntent } from '@/lib/indieweb/posse';
import type { WebmentionGroup } from '@/lib/indieweb/types';
import type { Backlink } from '@/lib/writings/backlinks';
import type { WritingData } from '@/lib/writings/types';

import BacklinksSection from './BacklinksSection';
import PostActions from './PostActions';

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
  const hasResponses = Boolean(hasWebmentions || backlinks.length > 0);

  return (
    <section className="pt-14">
      {hasResponses && (
        <div className="space-y-8">
          {hasWebmentions && webmentions && (
            <WebmentionSection webmentions={webmentions} />
          )}
          {backlinks.length > 0 && <BacklinksSection backlinks={backlinks} />}
        </div>
      )}
      <div
        role="group"
        aria-label="Post actions"
        className={hasResponses ? 'mt-8' : undefined}
      >
        <PostActions
          target={target}
          threadsHref={threadsPostIntent(writing, target)}
          title={writing.title}
        />
      </div>
    </section>
  );
}
