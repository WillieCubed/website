import WebmentionAvatar from '@/components/indieweb/WebmentionAvatar';
import WebmentionReplies from '@/components/indieweb/WebmentionReplies';

import type { Webmention, WebmentionGroup } from '@/lib/indieweb/types';

interface WebmentionSectionProps {
  webmentions: WebmentionGroup;
}

/** How many faces a facepile shows before the names line carries the rest. */
const FACEPILE_SIZE = 8;

/**
 * Replies are a conversation and get the room. Likes, reposts, and
 * bookmarks are reactions and get a quiet facepile each. Mentions from
 * other pages are listed by source.
 */
export default function WebmentionSection({
  webmentions,
}: WebmentionSectionProps) {
  const { likes, reposts, replies, mentions, bookmarks } = webmentions;
  const hasReactions =
    likes.length > 0 || reposts.length > 0 || bookmarks.length > 0;
  if (replies.length === 0 && !hasReactions && mentions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      {replies.length > 0 && <WebmentionReplies replies={replies} />}
      {hasReactions && (
        <div className="space-y-3">
          <Facepile items={likes} property="u-like" verb="Liked" />
          <Facepile items={reposts} property="u-repost" verb="Reposted" />
          <Facepile items={bookmarks} property="u-bookmark" verb="Bookmarked" />
        </div>
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

/**
 * One reaction kind as overlapping faces and a line naming who. Each face
 * is an `h-cite` under the reaction's property on the post's h-entry,
 * pointing at the like or repost where it lives.
 */
function Facepile({
  items,
  property,
  verb,
}: {
  items: Webmention[];
  property: 'u-like' | 'u-repost' | 'u-bookmark';
  verb: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-body-small text-muted">
      <ul className="flex">
        {items.slice(0, FACEPILE_SIZE).map((item, i) => (
          <li
            key={item.id}
            className={`${property} h-cite rounded-full ring-2 ring-ground ${i > 0 ? '-ml-2' : ''}`}
          >
            <data className="u-url" value={item.sourceUrl} />
            <WebmentionAvatar author={item.author} size="sm" />
          </li>
        ))}
      </ul>
      <p>
        {verb} by {names(items)}
      </p>
    </div>
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
