import SiteLink from '@/components/link/SiteLink';

import { formatDate } from '@/lib/site';
import { WritingData } from '@/lib/writings';

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
  const formattedDate = formatDate(lastUpdated);
  return (
    <SiteLink preview={false} href={`/writings/${slug}`} className="group">
      <div className="flex flex-col border-2 border-outline bg-surface-container-lowest p-lg transition duration-100 ease-in group-hover:bg-primary-container group-focus:bg-primary-container active:bg-primary-container">
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
    </SiteLink>
  );
}
