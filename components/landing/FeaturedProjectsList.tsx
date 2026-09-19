import SiteLink from '@/components/link/SiteLink';

import { ProjectData } from '@/lib/common';

interface FeaturedProjectsListProps {
  projects: ProjectData[];
}

export default function FeaturedProjectsList({
  projects,
}: FeaturedProjectsListProps) {
  return (
    <div className="grid tablet:grid-cols-2 gap-x-lg gap-y-lg">
      {projects.map((project) => (
        <div className="tablet:col-span-1" key={project.codename}>
          <FeaturedProjectCard project={project} labelText={`Project`} />
        </div>
      ))}
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
    <SiteLink preview={false} href={`/projects/${codename}`} className="group">
      <div className="flex flex-col border-2 border-outline bg-surface-container-lowest p-lg transition duration-100 ease-in group-hover:bg-primary-container group-focus:bg-primary-container active:bg-primary-container">
        <div className="space-y-sm">
          <div className="text-on-surface text-title-small">{labelText}</div>
          <div className="flex flex-col self-stretch gap-y-lg items-start">
            <div className="text-on-surface text-headline-large">{title}</div>
            <div className="text-headline-small text-primary">{tagline}</div>
          </div>
        </div>
      </div>
    </SiteLink>
  );
}
