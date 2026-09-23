import type { WebmentionAuthor } from '@/lib/indieweb/types';

interface WebmentionAvatarProps {
  author: WebmentionAuthor;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
};

/**
 * The author of a mention as a `p-author h-card`, so a parser reading the
 * comment or facepile it sits in knows who wrote it. Photos come from any
 * host, which the image optimizer would refuse, so they load as they are.
 */
export default function WebmentionAvatar({
  author,
  size = 'md',
  className = '',
}: WebmentionAvatarProps) {
  const sizeClass = sizeClasses[size];
  const name = author.name || 'Anonymous';
  const initial = name.charAt(0).toUpperCase();

  const content = author.photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={author.photo}
      alt={name}
      width={40}
      height={40}
      loading="lazy"
      decoding="async"
      className={`u-photo ${sizeClass} rounded-full object-cover ${className}`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${sizeClass} flex items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary ${className}`}
    >
      {initial}
    </span>
  );

  return (
    <span className="p-author h-card block flex-shrink-0">
      {author.name && <data className="p-name" value={author.name} />}
      {author.url ? (
        <a
          href={author.url}
          target="_blank"
          rel="noopener noreferrer"
          className="u-url block transition-opacity hover:opacity-80"
          title={name}
        >
          {content}
        </a>
      ) : (
        content
      )}
    </span>
  );
}
