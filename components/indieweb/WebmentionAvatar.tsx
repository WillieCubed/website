import Image from 'next/image';

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

export default function WebmentionAvatar({
  author,
  size = 'md',
  className = '',
}: WebmentionAvatarProps) {
  const sizeClass = sizeClasses[size];
  const name = author.name || 'Anonymous';
  const initial = name.charAt(0).toUpperCase();

  const content = author.photo ? (
    <Image
      src={author.photo}
      alt={name}
      width={40}
      height={40}
      className={`${sizeClass} rounded-full object-cover ${className}`}
    />
  ) : (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary ${className}`}
    >
      {initial}
    </div>
  );

  if (author.url) {
    return (
      <a
        href={author.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 transition-opacity hover:opacity-80"
        title={name}
      >
        {content}
      </a>
    );
  }

  return content;
}
