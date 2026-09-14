import Image from 'next/image';

import type { ReplyContext as ReplyContextData } from '@/lib/indieweb/reply-context';

interface ReplyContextProps {
  /** The reply context data */
  context: ReplyContextData;
  /** Label prefix (e.g., "In reply to", "Liked", "Reposted") */
  label?: string;
  /** Microformat class for the link */
  microformatClass?: string;
}

/**
 * Displays rich context for a reply or interaction target.
 * Shows author info, title, and content preview when available.
 */
export default function ReplyContext({
  context,
  label = 'In reply to',
  microformatClass = 'u-in-reply-to',
}: ReplyContextProps) {
  const hasRichData =
    context.authorName || context.title || context.contentPreview;

  // Parse hostname for fallback display
  let hostname = context.url;
  try {
    hostname = new URL(context.url).hostname;
  } catch {
    // Use full URL if parsing fails
  }

  const formattedDate = context.publishedAt
    ? new Date(context.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  // Simple context: just show the hostname link
  if (!hasRichData) {
    return (
      <div className="text-label-large text-on-surface-variant">
        {label}{' '}
        <a
          href={context.url}
          className={`${microformatClass} link-animated font-medium text-primary`}
        >
          {context.siteName || hostname}
        </a>
      </div>
    );
  }

  // Rich context: show author, title, preview
  return (
    <div className="h-cite rounded-lg border border-outline-variant bg-surface-container p-4">
      <p className="mb-2 text-label-medium text-on-surface-variant">{label}</p>

      <a
        href={context.url}
        className={`${microformatClass} group block`}
        rel="nofollow"
      >
        {/* Author row */}
        {context.authorName && (
          <div className="mb-2 flex items-center gap-2">
            {context.authorPhoto ? (
              <Image
                src={context.authorPhoto}
                alt={context.authorName}
                width={32}
                height={32}
                className="u-photo size-8 rounded-full object-cover"
                unoptimized // External images
              />
            ) : (
              <div className="size-8 rounded-full bg-primary/10" />
            )}
            <div className="flex flex-col">
              <span className="p-author h-card p-name text-label-large font-medium group-hover:text-primary">
                {context.authorName}
              </span>
              {context.siteName && (
                <span className="text-label-small text-on-surface-variant">
                  {context.siteName}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Title */}
        {context.title && (
          <h4 className="p-name mb-1 text-title-medium group-hover:text-primary">
            {context.title}
          </h4>
        )}

        {/* Content preview */}
        {context.contentPreview && (
          <p className="p-content line-clamp-3 text-body-medium text-on-surface-variant">
            {context.contentPreview}
          </p>
        )}

        {/* Date and source */}
        <div className="mt-2 flex items-center gap-2 text-label-small text-on-surface-variant">
          {formattedDate && (
            <>
              <time
                className="dt-published"
                dateTime={context.publishedAt?.toISOString()}
              >
                {formattedDate}
              </time>
              <span>·</span>
            </>
          )}
          <span>{context.siteName || hostname}</span>
        </div>
      </a>
    </div>
  );
}
