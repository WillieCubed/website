import { get } from '@vercel/edge-config';
import type { ProjectData } from '../../../lib/common';
import { getAllProjects } from '../../../lib/projects';
import { LinkButton } from '../../../components/LinkButton';

const FEATURED_PROJECTS_LIMIT = 3;

/**
 * Head for the /projects route.
 *
 * This injects OpenGraph Project tags with information specific to the projects
 * page.
 */
export async function generateMetadata() {
  const projects = await getAllProjects();
  const count = projects.length;

  return {
    title: 'Projects - Willie Chalmers III',
    description: `Willie Chalmers III studies artificial intelligence. Learn more about his ${count} personal project${
      count == 1 ? '' : 's'
    } here.`,
    openGraph: {
      siteName: 'Willie Chalmers III',
      title: 'Projects Overview',
      description: `Willie Chalmers III studies artificial intelligence. Learn more about his ${count} personal project${
        count == 1 ? '' : 's'
      } here.`,
      url: '/projects',
    },
  };
}

interface ProjectsPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

/**
 * A page showing off all of my projects
 *
 * Route: /projects
 */
export default async function ProjectsPage({
  searchParams,
}: ProjectsPageProps) {
  const { projects } = await getProjectsPageData();

  // Yeah I know this isn't thread-safe, but this is a personal app, okay?
  const initialQuery =
    searchParams['q'] && typeof searchParams['q'] === 'string'
      ? searchParams['q']
      : '';

  // TODO: If project type is unknown, throw error
  const featuredProjects = await filterFeaturedProjects(projects);
  const sortedProjects = projects.sort((a, b) => {
    return b.launched.getTime() - a.launched.getTime();
  });
  const timelineItems = sortedProjects.map((project) => (
    <ProjectTimelineItem key={project.codename} project={project} />
  ));

  return (
    <main className="min-h-dvh max-w-breakpoint-2xl mx-auto tablet:grid tablet:grid-cols-8 tablet:gap-lg">
      <section className="tablet:col-span-3 tablet:col-start-2 mt-16">
        <div className="sticky top-32 space-y-xl px-lg desktop-large:px-0">
          <div className="space-y-lg ">
            <div className="text-display-small">Projects</div>
            <div className="text-headline-medium">My bread and butter.</div>
          </div>
          <div className="*:text-body-medium space-y-sm">
            <p>
              These are projects I’ve substantially contributed to, whether in a
              personal, quasi-professional, or professional capacity.
            </p>
            <p>
              As an engineer not afraid of design, my work focuses on creating
              meaningful, straightforward experiences for users with software.
            </p>
          </div>
        </div>
      </section>
      <section className="tablet:col-span-6 tablet:col-start-5 mt-[96px] px-lg">
        {timelineItems}
      </section>
    </main>
  );
}

interface ProjectTimelineItemProps {
  project: ProjectData;
}

function ProjectTimelineItem({ project }: ProjectTimelineItemProps) {
  return (
    <div className="flex space-x-lg">
      <div className="flex flex-col">
        <div className="size-8 bordered border-on-surface-foreground dark:border-on-surface-foreground-dark"></div>
        <div className="flex-grow flex justify-center">
          <div className="w-[2px] h-full bg-on-surface-foreground dark:bg-on-surface-foreground-dark"></div>
        </div>
      </div>
      <article className="space-y-xl pb-16">
        <div className="">
          <div className="space-y-lg">
            <div>
              <div className="text-label-small">
                {project.clientAttribution}
              </div>
              <div className="text-headline-large">{project.title}</div>
            </div>
            <div className="max-w-[480px] text-title-medium">
              {project.tagline}
            </div>
          </div>
          <div className="mt-lg space-x-sm">
            <LinkButton
              href={`/projects/${project.codename}`}
              label={'Read more'}
            ></LinkButton>
          </div>
        </div>
        <div className="space-x-lg">{/* Screenshots */}</div>
      </article>
    </div>
  );
}

type ProjectsPageData = {
  projects: ProjectData[];
};

/**
 * A wrapper function that provides data needed to render the projects overview.
 *
 * @returns All projects
 */
async function getProjectsPageData(): Promise<ProjectsPageData> {
  try {
    const projects = await getAllProjects();
    return { projects };
  } catch (error) {
    console.error('Could not fetch projects', error);
    throw error;
  }
}
/**
 *
 * @returns A list of codenames for projects that should be featured on the projects page.
 */
async function getFeaturedProjectCodenames() {
  try {
    const featuredProjectCodenames = await get<string[]>('featuredProjects');
    return featuredProjectCodenames ?? [];
  } catch (error) {
    console.error('Could not fetch featured projects', error);
    return [];
  }
}

/**
 * Returns a list of projects that should be featured on the projects page.
 */
async function filterFeaturedProjects(
  projects: ProjectData[]
): Promise<ProjectData[]> {
  const featuredCodenames = await getFeaturedProjectCodenames();

  if (featuredCodenames.length === 0) {
    return projects.slice(0, FEATURED_PROJECTS_LIMIT);
  }

  const featuredProjects = projects.filter(({ codename }) =>
    featuredCodenames.includes(codename)
  );
  return featuredProjects;
}
