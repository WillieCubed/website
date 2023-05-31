import type { Metadata } from 'next';
import ProjectCard from '../../../../components/ProjectCard';
import StyledBackButton from '../../../../components/StyledButton';
import { ProjectData, getProject, getProjects } from '../../../../lib/projects';

/**
 * Head for the /projects/[codename] route.
 *
 * This injects OpenGraph Project tags with information specific to the project
 * with the given codename.
 */
export async function generateMetadata({
  params,
}: {
  params: { codename: string };
}): Promise<Metadata> {
  const { codename } = params;
  try {
    const projectData = await getProject(codename);
    return {
      title: `${projectData.name} Project Info - Willie Chalmers III`,
      description: projectData.overview,
      openGraph: {
        title: projectData.name,
        description: projectData.overview,
        url: generateProjectUrl(projectData),
        // TODO: Choose a different image for a project
      },
    };
  } catch (e) {
    return {
      title: 'Unknown Project Info - Willie Chalmers III',
      description:
        "There's supposed to be a project here, but we can't seem to find the info!",
    };
  }
}

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://williecubed.me/projects';

/**
 * Generate a canonical URL for a project's meta social information.
 */
function generateProjectUrl({ codename }: ProjectData) {
  return `${BASE_URL}/${codename}`;
}

type ProjectDetailPageParams = {
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
