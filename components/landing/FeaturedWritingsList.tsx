import Link from 'next/link';
import { WritingData } from '../../lib/writings';

interface FeaturedWritingsListProps {
  writings: WritingData[];
}

export default function FeaturedWritingsList({
  writings,
}: FeaturedWritingsListProps) {
  return (
    <div className="grid tablet:grid-cols-2 gap-x-lg gap-y-lg">
      {writings.map((writing) => (
        <div className="tablet:col-span-1" key={writing.slug}>
          <FeaturedWritingItem writing={writing} />
        </div>
      ))}
    </div>
  );
}

interface FeaturedProjectCardProps {
  writing: WritingData;
}

function FeaturedWritingItem({ writing }: FeaturedProjectCardProps) {
  const { title, slug, description, lastUpdated } = writing;
  const formattedDate = new Date(lastUpdated).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  return (
    <Link href={`/writings/${slug}`} className="group">
      <div className="flex flex-col p-lg bg-surface-foreground dark:bg-surface-foreground-dark border-2 group-hover:bg-maverick-100 group-focus:bg-maverick-100 active:bg-maverick-100 dark:group-hover:bg-maverick-700 dark:group-focus:bg-maverick-700 dark:active:bg-maverick-700 transition ease-in duration-100 border-on-surface-foreground">
        <div className="space-y-sm">
          {lastUpdated && (
            <div className="text-on-surface text-title-small">
              {formattedDate}
            </div>
          )}
          <div className="flex flex-col self-stretch gap-y-lg items-start">
            <div className="text-on-surface text-headline-medium">{title}</div>
            <div className="text-title-medium">{description}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}
