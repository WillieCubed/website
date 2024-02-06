import Link from 'next/link';
import { ProjectData } from '../../lib/common';

interface FeaturedProjectsListProps {
  projects: ProjectData[];
}

export default function FeaturedProjectsList({
  projects,
}: FeaturedProjectsListProps) {
  return (
    <div className="grid lg:grid-cols-2 gap-x-lg gap-y-lg">
      <>
        {projects.map((project) => (
          <FeaturedProjectCard
            key={project.codename}
            project={project}
            labelText={`Project`}
          />
        ))}
      </>
    </div>
  );
}

interface FeaturedProjectCardProps {
  project: ProjectData;
  labelText: string;
}

function FeaturedProjectCard({
  project,
  labelText = 'Project',
}: FeaturedProjectCardProps) {
  const { title, tagline, codename } = project;
  return (
    <Link href={`/projects/${codename}`} className="group">
      <div className="flex flex-col max-w-[456px] p-lg bg-surface-foreground dark:bg-surface-foreground-dark border-2 group-hover:bg-maverick-100 group-focus:bg-maverick-100 active:bg-maverick-100 dark:group-hover:bg-maverick-700 dark:group-focus:bg-maverick-700 dark:active:bg-maverick-700 transition ease-in duration-100 border-on-surface-foreground">
        <div className="space-y-2">
          <div className="text-on-surface text-title-small">{labelText}</div>
          <div className="flex flex-col self-stretch gap-y-lg items-start">
            <div className="text-on-surface text-headline-large">{title}</div>
            <div className="text-headline-small text-maverick-500">
              {tagline}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
