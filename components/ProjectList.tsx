import { ProjectData } from '../../../lib/projects';
import ProjectCard from './ProjectCard';

interface ProjectsListProps {
  projects: ProjectData[];
}

export default function ProjectList({ projects }: ProjectsListProps) {
  const cards = projects.map((project) => {
    return <ProjectCard key={project.codename} {...project} />;
  });
  return (
    <div className="lg:grid lg:grid-cols-2 lg:gap-x-[16px] snap-y">
      {projects.length > 0 ? (
        cards
      ) : (
        <div className="px-4 py-8 lg:px-0 text-display-small">
          Looks like I&apos;m not working on anything at the moment!
        </div>
      )}
    </div>
  );
}