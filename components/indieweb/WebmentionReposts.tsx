import WebmentionAvatar from '@/components/indieweb/WebmentionAvatar';

import type { Webmention } from '@/lib/indieweb/types';

interface WebmentionRepostsProps {
  reposts: Webmention[];
}

export default function WebmentionReposts({ reposts }: WebmentionRepostsProps) {
  if (reposts.length === 0) return null;

  const displayedReposts = reposts.slice(0, 10);
  const remainingCount = reposts.length - displayedReposts.length;

  return (
    <div className="space-y-3">
      <h3 className="text-title-small font-medium">
        {reposts.length} {reposts.length === 1 ? 'Repost' : 'Reposts'}
      </h3>
      <div className="flex flex-wrap items-center gap-1">
        {displayedReposts.map((repost) => (
          <WebmentionAvatar key={repost.id} author={repost.author} size="sm" />
        ))}
        {remainingCount > 0 && (
          <span className="ml-2 text-label-medium text-gray-500 dark:text-gray-400">
            +{remainingCount} more
          </span>
        )}
      </div>
    </div>
  );
}
