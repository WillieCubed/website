import ProjectCard from '../../../components/ProjectCard';
import StyledBackButton from '../../../components/StyledButton';
import { getProject, getProjects } from '../../../lib/projects';

export type ProjectDetailPageParams = {
  codename: string;
};

/**
 * A page that shows extended information about a project.
 * Route: /projects/<codename>
 */
export default async function ProjectDetailPage({
  params,
}: {
  params: ProjectDetailPageParams;
}) {
  const { codename } = params;
  const project = await getProject(codename);

  return (
    <main className="min-h-[75vh]">
      <div className="xl:grid xl:grid-cols-12">
        <div className="py-8 px-8 xl:px-0 xl:col-start-4 col-span-6">
          <StyledBackButton>Back to all projects</StyledBackButton>
        </div>
        <section className="pb-8 xl:col-start-4 col-span-6">
          <ProjectCard {...project} mode="expanded" />
        </section>
        {/* TODO: Give context, backstory/motivation, and updates for each project. */}
      </div>
    </main>
  );
}

/**
 * Generate valid codename params for route
 * @returns
 */
export async function generateStaticParams() {
  const posts = await getProjects();

  return posts.map((project) => ({
    codename: project.codename,
  }));
}
