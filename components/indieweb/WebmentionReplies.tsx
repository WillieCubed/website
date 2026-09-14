import WebmentionAvatar from '@/components/indieweb/WebmentionAvatar';

import type { Webmention } from '@/lib/indieweb/types';

interface WebmentionRepliesProps {
  replies: Webmention[];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function WebmentionReplies({ replies }: WebmentionRepliesProps) {
  if (replies.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-title-small font-medium">
        {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
      </h3>
      <div className="space-y-4">
        {replies.map((reply) => (
          <div key={reply.id} className="flex gap-3">
            <WebmentionAvatar author={reply.author} size="md" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                {reply.author.url ? (
                  <a
                    href={reply.author.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-label-large font-medium hover:text-primary"
                  >
                    {reply.author.name || 'Anonymous'}
                  </a>
                ) : (
                  <span className="text-label-large font-medium">
                    {reply.author.name || 'Anonymous'}
                  </span>
                )}
                {reply.publishedAt && (
                  <span className="text-label-small text-gray-500 dark:text-gray-400">
                    {formatDate(reply.publishedAt)}
                  </span>
                )}
              </div>
              {reply.content && (
                <p className="text-body-medium text-gray-700 dark:text-gray-300">
                  {reply.content}
                </p>
              )}
              <a
                href={reply.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-label-small text-primary hover:underline"
              >
                View original
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
