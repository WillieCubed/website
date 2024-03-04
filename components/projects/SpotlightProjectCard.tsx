import Link from 'next/link';

import { PROJECT_TYPE_MAP, ProjectData } from '@/lib/common';

interface SpotlightProjectCardProps {
  project: ProjectData;
}

export default function SpotlightProjectCard({
  project,
}: SpotlightProjectCardProps) {
  const projectTypeLabel = PROJECT_TYPE_MAP[project.type];
  return (
    <div className="h-[320px] max-w-[480px] flex-1 px-4 py-6 flex flex-col shrink-0 justify-between bg-surface-foreground dark:bg-slate-900 border-2 border-black">
      <div className="flex flex-col space-y-2">
        <div className="text-label-medium">{projectTypeLabel}</div>
        <div className="text-display-medium font-display text-primary self-stretch">
          {project.title}
        </div>
      </div>
      <div className="text-title-medium">{project.tagline}</div>
      <div className="h-20 flex items-start self-stretch"></div>
      <div className="flex flex-row space-x-4">
        <Link
          className="text-primary text-label-large"
          href={`/projects/${project.codename}`}
        >
          Learn More
        </Link>
      </div>
    </div>
  );
}
