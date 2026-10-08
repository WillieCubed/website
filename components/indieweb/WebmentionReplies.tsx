import WebmentionAvatar from '@/components/indieweb/WebmentionAvatar';
import SiteLink from '@/components/link/SiteLink';
import NativeVideo from '@/components/media/NativeVideo';

import { sanitizeCommentHtml } from '@/lib/indieweb/comment-content';
import type { PublishingResponse } from '@/lib/indieweb/types';
import { formatDate } from '@/lib/site';

interface WebmentionRepliesProps {
  replies: PublishingResponse[];
  label?: string;
}

/**
 * Each reply is its author, when they wrote it, and what they said. The
 * date links to the reply where it lives. Every reply is a `p-comment
 * h-cite` on the post's h-entry, so the conversation reads the same to a
 * parser as it does on the page. A reply the source marked up shows its
 * sanitized markup as `e-content`; one it gave as text shows as `p-content`.
 */
export default function WebmentionReplies({
  replies,
  label = 'Replies',
}: WebmentionRepliesProps) {
  if (replies.length === 0) return null;

  return (
    <section aria-label={label} className="space-y-4">
      <h2 className="text-label-medium text-muted">
        {replies.length}{' '}
        {label === 'Replies'
          ? replies.length === 1
            ? 'reply'
            : 'replies'
          : label.toLowerCase()}
      </h2>
      <ul className="space-y-3">
        {replies.map((reply) => (
          <li
            key={reply.id}
            style={
              reply.threadDepth
                ? {
                    marginInlineStart: `${Math.min(reply.threadDepth, 3) * 12}px`,
                  }
                : undefined
            }
            className="p-comment h-cite -mx-4 flex gap-3 rounded-2xl border border-line bg-card px-4 py-3"
          >
            <WebmentionAvatar author={reply.author} size="md" />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-label-medium text-muted">
                {reply.author.url ? (
                  <SiteLink
                    href={reply.author.url}
                    rel="nofollow ugc noopener"
                    className="text-label-large font-medium text-ink hover:text-accent"
                  >
                    {reply.author.name || 'Someone'}
                  </SiteLink>
                ) : (
                  <span className="text-label-large font-medium text-ink">
                    {reply.author.name || 'Someone'}
                  </span>
                )}
                <SiteLink
                  href={reply.sourceUrl}
                  rel="nofollow ugc noopener"
                  className="u-url hover:text-ink"
                >
                  {reply.publishedAt ? (
                    <time
                      className="dt-published"
                      dateTime={reply.publishedAt.toISOString()}
                    >
                      {formatDate(reply.publishedAt, 'short')}
                    </time>
                  ) : (
                    new URL(reply.sourceUrl).hostname
                  )}
                </SiteLink>
              </p>
              {reply.contentHtml ? (
                <div
                  className="e-content space-y-2 text-body-medium text-ink [&_a]:link-animated [&_blockquote]:border-l-2 [&_blockquote]:border-line [&_blockquote]:pl-3 [&_code]:font-mono [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_img]:max-h-96 [&_img]:w-auto [&_img]:max-w-full [&_img]:rounded-xl [&_video]:max-h-96 [&_video]:w-full [&_video]:rounded-xl [&_audio]:w-full [&_figcaption]:text-muted [&_a.u-attachment]:inline-flex [&_a.u-attachment]:max-w-full [&_a.u-attachment]:rounded-full [&_a.u-attachment]:bg-soft [&_a.u-attachment]:px-4 [&_a.u-attachment]:py-2 [&_a.u-attachment]:break-words"
                  // Sanitized again here, not only when stored, so a row
                  // written by older code or by hand cannot carry script.
                  dangerouslySetInnerHTML={{
                    __html: sanitizeCommentHtml(
                      reply.contentHtml,
                      reply.sourceUrl
                    ),
                  }}
                />
              ) : (
                reply.content && (
                  <p className="p-content whitespace-pre-wrap break-words text-body-medium text-ink">
                    {reply.content}
                  </p>
                )
              )}
              {reply.media?.map((media, index) => (
                <figure key={`${media.url}:${index}`} className="pt-2">
                  {media.kind === 'image' ? (
                    // Remote response media is fetched by the reader, never optimized by the server.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={media.url}
                      alt={media.description || 'Image attached to this reply'}
                      loading="lazy"
                      className="max-h-96 max-w-full rounded-xl"
                    />
                  ) : media.kind === 'video' ? (
                    <NativeVideo
                      src={media.url}
                      poster={media.poster}
                      description={media.description || 'Reply video'}
                      sourceUrl={reply.sourceUrl}
                      className="max-h-96 w-full rounded-xl"
                    />
                  ) : media.kind === 'audio' ? (
                    <audio
                      src={media.url}
                      controls
                      preload="none"
                      className="w-full"
                      aria-label={media.description || 'Reply audio'}
                    />
                  ) : (
                    <SiteLink
                      href={media.url}
                      className="inline-flex max-w-full rounded-full bg-soft px-4 py-2 text-label-large text-ink break-words"
                    >
                      {media.description || 'Attachment'}
                    </SiteLink>
                  )}
                  {media.description && media.kind !== 'file' && (
                    <figcaption className="pt-1 text-body-small text-muted">
                      {media.description}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
