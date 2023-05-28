import ProjectCard from '../../../../components/ProjectCard';
import { ProjectData, getProjects } from '../../../../lib/projects';

/**
 * A simple scrolling list of projects.
 */
function CustomProjectsList({ projects }: { projects: ProjectData[] }) {
  const cards = projects.map((project) => {
    return <ProjectCard key={project.codename} {...project} />;
  });

  return <div className="space-y-4">{cards}</div>;
}

/**
 * A page showing off all of my projects.
 *
 * Route: /projects/all
 */
export default async function ProjectsPage() {
  const { projects } = await getAllProjectsPageData();

  return (
    <main className="py-4 lg:py-8">
      <section id="overview" className="mt-4 max-w-3xl mx-auto">
        <h1 className="font-bold font-display text-4xl">All Projects</h1>
        <div className="mt-2 text-lg">
          See everything I&apos;m working on here.
        </div>
      </section>
      <section className="mt-4 max-w-3xl mx-auto">
        <CustomProjectsList projects={projects} />
      </section>
    </main>
  );
}

type ProjectsPageProps = {
  projects: ProjectData[];
};

/**
 * A wrapper function that provides data needed to render the projects overview.
 *
 * @returns All projects
 */
async function getAllProjectsPageData(): Promise<ProjectsPageProps> {
  try {
    const projects = await getProjects();
    return { projects };
  } catch (error) {
    console.error('Could not fetch projects', error);
    throw error;
  }
}
