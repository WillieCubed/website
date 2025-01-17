import Image from 'next/image';

import { ProjectFeature } from '@/lib/common';

interface FeatureListProps {
  features: ProjectFeature[];
}

export default function FeatureList({ features }: FeatureListProps) {
  return (
    <div className="flex flex-wrap align-start">
      {features.map((feature) => {
        return (
          <ProjectFeatureItem
            key={feature.label + feature.description}
            {...feature}
          />
        );
      })}
    </div>
  );
}

function ProjectFeatureItem({ label, description, imageUrl }: ProjectFeature) {
  return (
    <div className="flex flex-col items-start space-y-4 shrink-0 h-[240px] max-w-[456px]">
      <Image src={imageUrl} alt="" className="object-fit" />
      <div className="text-title-large">{label}</div>
      <div className="text-label-large items-stretch">{description}</div>
    </div>
  );
}
