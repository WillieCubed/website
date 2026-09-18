import WebmentionAvatar from '@/components/indieweb/WebmentionAvatar';

import type { Webmention } from '@/lib/indieweb/types';
import { formatDate } from '@/lib/site';

interface WebmentionRepliesProps {
  replies: Webmention[];
}

/**
 * Each reply is its author, when they wrote it, and what they said. The
 * date links to the reply where it lives.
 */
export default function WebmentionReplies({ replies }: WebmentionRepliesProps) {
  if (replies.length === 0) return null;

  return (
    <section aria-label="Replies" className="space-y-4">
      <h2 className="text-label-medium text-muted">
        {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
      </h2>
      <ul className="space-y-3">
        {replies.map((reply) => (
          <li
            key={reply.id}
            className="flex gap-3 rounded-2xl border border-line bg-card px-4 py-3"
          >
            <WebmentionAvatar author={reply.author} size="md" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-label-medium text-muted">
                {reply.author.url ? (
                  <a
                    href={reply.author.url}
                    rel="noopener"
                    className="text-label-large font-medium text-ink hover:text-accent"
                  >
                    {reply.author.name || 'Someone'}
                  </a>
                ) : (
                  <span className="text-label-large font-medium text-ink">
                    {reply.author.name || 'Someone'}
                  </span>
                )}
                <a
                  href={reply.sourceUrl}
                  rel="noopener"
                  className="hover:text-ink"
                >
                  {reply.publishedAt
                    ? formatDate(reply.publishedAt, 'short')
                    : new URL(reply.sourceUrl).hostname}
                </a>
              </p>
              {reply.content && (
                <p className="text-body-medium text-ink">{reply.content}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
