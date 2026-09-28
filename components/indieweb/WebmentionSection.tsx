import WebmentionAvatar from '@/components/indieweb/WebmentionAvatar';
import WebmentionReplies from '@/components/indieweb/WebmentionReplies';

import type { Webmention, WebmentionGroup } from '@/lib/indieweb/types';

interface WebmentionSectionProps {
  webmentions: WebmentionGroup;
}

/** How many faces a facepile shows before the names line carries the rest. */
const FACEPILE_SIZE = 8;

/**
 * The RSVP answers a post shows, each with the line under its faces. A `no`
 * is stored and counted in feeds but not shown, so a post never lists who
 * declined.
 */
const RSVP_GROUPS = [
  {
    answer: 'yes',
    line: (who: string, one: boolean) => `${who} ${one ? 'is' : 'are'} going`,
  },
  { answer: 'maybe', line: (who: string) => `${who} might go` },
  {
    answer: 'interested',
    line: (who: string, one: boolean) =>
      `${who} ${one ? 'is' : 'are'} interested`,
  },
] as const;

function shownRsvps(rsvps: Webmention[]): Webmention[] {
  return rsvps.filter((rsvp) => rsvp.rsvp && rsvp.rsvp !== 'no');
}

/** Whether the section would render anything for this group. */
export function hasVisibleWebmentions(group: WebmentionGroup): boolean {
  return (
    group.likes.length > 0 ||
    group.reposts.length > 0 ||
    group.replies.length > 0 ||
    group.mentions.length > 0 ||
    group.bookmarks.length > 0 ||
    shownRsvps(group.rsvps).length > 0
  );
}

/**
 * Replies are a conversation and get the room. Likes, reposts, bookmarks,
 * and RSVPs are reactions and get a quiet facepile each, with RSVPs grouped
 * by answer. Mentions from other pages are listed by source.
 */
export default function WebmentionSection({
  webmentions,
}: WebmentionSectionProps) {
  const { likes, reposts, replies, mentions, bookmarks, rsvps } = webmentions;
  if (!hasVisibleWebmentions(webmentions)) return null;
  const answered = shownRsvps(rsvps);
  const hasReactions =
    likes.length > 0 ||
    reposts.length > 0 ||
    bookmarks.length > 0 ||
    answered.length > 0;

  return (
    <div className="space-y-8">
      {replies.length > 0 && <WebmentionReplies replies={replies} />}
      {hasReactions && (
        <div className="space-y-3">
          <Facepile
            items={likes}
            property="u-like"
            line={(who) => `Liked by ${who}`}
          />
          <Facepile
            items={reposts}
            property="u-repost"
            line={(who) => `Reposted by ${who}`}
          />
          <Facepile
            items={bookmarks}
            property="u-bookmark"
            line={(who) => `Bookmarked by ${who}`}
          />
          {RSVP_GROUPS.map(({ answer, line }) => (
            <Facepile
              key={answer}
              items={answered.filter((rsvp) => rsvp.rsvp === answer)}
              property="u-rsvp"
              line={line}
            />
          ))}
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
 * pointing at the like, repost, or RSVP where it lives. An RSVP face keeps
 * its answer as `p-rsvp`, so a parser can count who is coming.
 */
function Facepile({
  items,
  property,
  line,
}: {
  items: Webmention[];
  property: 'u-like' | 'u-repost' | 'u-bookmark' | 'u-rsvp';
  line: (who: string, one: boolean) => string;
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
            {item.rsvp && <data className="p-rsvp" value={item.rsvp} />}
            <WebmentionAvatar author={item.author} size="sm" />
          </li>
        ))}
      </ul>
      <p>{line(names(items), items.length === 1)}</p>
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
