import WebmentionAvatar from '@/components/indieweb/WebmentionAvatar';
import WebmentionReplies from '@/components/indieweb/WebmentionReplies';

import type { Webmention, WebmentionGroup } from '@/lib/indieweb/types';

interface WebmentionSectionProps {
  webmentions: WebmentionGroup;
}

/**
 * Replies are a conversation and get the room. Likes, reposts, and
 * bookmarks are reactions and get one quiet line. Mentions from other
 * pages are listed by source.
 */
export default function WebmentionSection({
  webmentions,
}: WebmentionSectionProps) {
  const { likes, reposts, replies, mentions, bookmarks } = webmentions;
  const reactions = [...likes, ...reposts, ...bookmarks];
  if (replies.length === 0 && reactions.length === 0 && mentions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      {replies.length > 0 && <WebmentionReplies replies={replies} />}
      {reactions.length > 0 && (
        <Reactions likes={likes} reposts={reposts} bookmarks={bookmarks} />
      )}
      {mentions.length > 0 && <Mentions mentions={mentions} />}
    </div>
  );
}

function names(items: Webmention[]): string {
  const list = items.map((item) => item.author.name || 'someone');
  if (list.length <= 2) return list.join(' and ');
  if (list.length === 3) return `${list[0]}, ${list[1]}, and ${list[2]}`;
  return `${list[0]}, ${list[1]}, and ${list.length - 2} others`;
}

function Reactions({
  likes,
  reposts,
  bookmarks,
}: {
  likes: Webmention[];
  reposts: Webmention[];
  bookmarks: Webmention[];
}) {
  const faces = [...likes, ...reposts, ...bookmarks].slice(0, 8);
  const parts = [
    likes.length > 0 && `Liked by ${names(likes)}`,
    reposts.length > 0 && `Reposted by ${names(reposts)}`,
    bookmarks.length > 0 && `Bookmarked by ${names(bookmarks)}`,
  ].filter(Boolean);
  return (
    <p className="flex flex-wrap items-center gap-3 text-body-small text-muted">
      <span className="flex">
        {faces.map((item, i) => (
          <span
            key={item.id}
            className={`rounded-full ring-2 ring-ground ${i > 0 ? '-ml-2' : ''}`}
          >
            <WebmentionAvatar author={item.author} size="sm" />
          </span>
        ))}
      </span>
      <span>{parts.join(' · ')}</span>
    </p>
  );
}

function Mentions({ mentions }: { mentions: Webmention[] }) {
  return (
    <ul className="space-y-1 text-body-small text-muted">
      {mentions.map((mention) => (
        <li key={mention.id}>
          <a href={mention.sourceUrl} rel="noopener" className="link-animated">
            {mention.author.name || new URL(mention.sourceUrl).hostname}
          </a>{' '}
          mentioned this
        </li>
      ))}
    </ul>
  );
}
