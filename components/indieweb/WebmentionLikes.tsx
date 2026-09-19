import WebmentionAvatar from '@/components/indieweb/WebmentionAvatar';

import type { Webmention } from '@/lib/indieweb/types';

interface WebmentionLikesProps {
  likes: Webmention[];
}

export default function WebmentionLikes({ likes }: WebmentionLikesProps) {
  if (likes.length === 0) return null;

  const displayedLikes = likes.slice(0, 10);
  const remainingCount = likes.length - displayedLikes.length;

  return (
    <div className="space-y-3">
      <h3 className="text-title-small font-medium">
        {likes.length} {likes.length === 1 ? 'Like' : 'Likes'}
      </h3>
      <div className="flex flex-wrap items-center gap-1">
        {displayedLikes.map((like) => (
          <WebmentionAvatar key={like.id} author={like.author} size="sm" />
        ))}
        {remainingCount > 0 && (
          <span className="ml-2 text-label-medium text-muted">
            +{remainingCount} more
          </span>
        )}
      </div>
    </div>
  );
}
