import Image from 'next/image';
import Link from 'next/link';

interface FeaturedWorkCardProps {
  type: string;
  title: string;
  tagline: string;
  description: string;
  timePeriod: string;
  mainLink: string;
  caseStudyLink: string;
  imageUrl?: string;
}

export default function FeaturedWorkCard({
  type,
  title,
  tagline,
  description,
  timePeriod,
  mainLink,
  caseStudyLink,
  imageUrl,
}: FeaturedWorkCardProps) {
  return (
    <div className="p-lg bordered flex space-x-lg surface">
      <div className="flex-1 flex flex-col space-y-lg">
        <div className="space-y-md">
          <div className="text-title-small font-display">{type}</div>
          <div className="text-display-medium text-primary font-display">
            {title}
          </div>
          <div className="text-headline-small font-display">{tagline}</div>
        </div>
        <div className="space-y-sm">
          <div className="text-title-medium">{description}</div>
          <div className="text-title-small">{timePeriod}</div>
        </div>
        <div>
          <div className="flex space-x-4">
            <Link href={mainLink} className="font-display text-label-large">
              Open
            </Link>
            {/* TODO: Re-enable case study link when available */}
            {/* <Link href={caseStudyLink} className="font-display text-label-large">
              View case study
            </Link> */}
          </div>
        </div>
      </div>
      <div className="flex-1 block h-full w-full max-w-[420px] bg-primary-light-1">
        {imageUrl ? (
          <Image src={imageUrl} alt={title} />
        ) : (
          <div className="h-full w-full bg-primary"></div>
        )}
        {/* Project Image */}
      </div>
    </div>
  );
}
