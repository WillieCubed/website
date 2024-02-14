import Link from 'next/link';
import { WritingData } from '../../lib/writings';

interface WritingItemProps {
  writing: WritingData;
}

export default function WritingItem({ writing }: WritingItemProps) {
  return (
    <Link
      className="block py-sm max-w-breakpoint-md group"
      href={`/writings/${writing.slug}`}
    >
      <div className="space-y-sm">
        <div className="text-title-large underline group-hover:text-primary group-focus:text-primary transition ease-out duration-150">
          {writing.title}
        </div>
        <div className="text-title-medium">{writing.description}</div>
      </div>
    </Link>
  );
}
