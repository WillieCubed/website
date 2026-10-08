import WebmentionAvatar from '@/components/indieweb/WebmentionAvatar';
import WebmentionReplies from '@/components/indieweb/WebmentionReplies';

import type {
  PublishingResponse,
  ResponseGroup as WebmentionGroup,
} from '@/lib/indieweb/types';
import { formatDate } from '@/lib/site';

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

function shownRsvps(rsvps: PublishingResponse[]): PublishingResponse[] {
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
      {mentions.some(
        (item) => item.origin === 'atproto' || item.media?.length
      ) && (
        <WebmentionReplies
          replies={mentions.filter(
            (item) => item.origin === 'atproto' || item.media?.length
          )}
          label="Quotes and mentions"
        />
      )}
      {mentions.some(
        (item) => item.origin !== 'atproto' && !item.media?.length
      ) && (
        <Mentions
          mentions={mentions.filter(
            (item) => item.origin !== 'atproto' && !item.media?.length
          )}
        />
      )}
    </div>
  );
}

function names(items: PublishingResponse[]): string {
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
  items: PublishingResponse[];
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

/** How much of a titleless mention's text stands in for its title. */
const EXCERPT_LENGTH = 140;

function excerpt(text: string): string {
  const squashed = text.replace(/\s+/g, ' ').trim();
  if (squashed.length <= EXCERPT_LENGTH) return squashed;
  const cut = squashed.slice(0, EXCERPT_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > EXCERPT_LENGTH / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Pages that link here without replying or reacting. Each is a
 * `u-mention h-cite` on the post's h-entry: the citing post's address, its
 * title or else the start of its text, and who wrote it and when, as far as
 * its markup said. The host stands in for a missing author, so every line
 * says where the mention lives.
 */
function Mentions({ mentions }: { mentions: PublishingResponse[] }) {
  return (
    <ul className="space-y-3 text-body-small text-muted">
      {mentions.map((mention) => {
        const host = new URL(mention.sourceUrl).hostname;
        const { author } = mention;
        return (
          <li key={mention.id} className="u-mention h-cite space-y-0.5">
            <a
              href={mention.sourceUrl}
              rel="noopener"
              className="u-url link-animated text-body-medium text-ink"
            >
              {mention.name ? (
                <span className="p-name">{mention.name}</span>
              ) : mention.content ? (
                <span className="p-content">{excerpt(mention.content)}</span>
              ) : (
                host
              )}
            </a>
            <p className="flex flex-wrap items-baseline gap-x-2 text-label-medium">
              {author.name ? (
                <span className="p-author h-card">
                  {author.photo && (
                    <data className="u-photo" value={author.photo} />
                  )}
                  {author.url ? (
                    <a
                      href={author.url}
                      rel="noopener"
                      className="p-name u-url hover:text-ink"
                    >
                      {author.name}
                    </a>
                  ) : (
                    <span className="p-name">{author.name}</span>
                  )}
                </span>
              ) : (
                <span>{host}</span>
              )}
              {mention.publishedAt && (
                <time
                  className="dt-published"
                  dateTime={mention.publishedAt.toISOString()}
                >
                  {formatDate(mention.publishedAt, 'short')}
                </time>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
