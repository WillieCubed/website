import Link from 'next/link';
import LinkButton from '../../../components/LinkButton';
import ProjectList from '../../../components/ProjectList';
import { ProjectData, getProjects } from '../../../lib/projects';

const FEATURED_PROJECTS_LIMIT = 3;

export async function generateMetadata() {
  const projects = await getProjects();
  const count = projects.length;

  return {
    title: 'Projects - Willie Chalmers III',
    description: `Willie Chalmers III studies artificial intelligence. Learn more about his Learn about his ${count} personal project${
      count == 1 ? '' : 's'
    } here.`,
    openGraph: {
      title: 'Research Overview',
      description: `Willie Chalmers III studies artificial intelligence. Learn more about his Learn about his ${count} personal project${
        count == 1 ? '' : 's'
      } here.`,
      url: '/projects',
    },
  };
}

function SpotlightProjectCard({ project }: { project: ProjectData }) {
  return (
    <div className="h-[320px] p-6 flex flex-col justify-between bg-surface-foreground dark:bg-slate-900 border-2 border-black">
      <div className="flex flex-col space-y-2">
        <div className="text-label-medium">Personal Project</div>
        <div className="text-display-medium font-display text-primary">
          {project.name}
        </div>
        <div className="text-label-small font-mono">In development</div>
      </div>
      <div className="text-title-medium">{project.overview}</div>
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

/**
 * A page showing off all of my projects
 *
 * Route: /projects
 */
export default async function ProjectsPage() {
  const { projects } = await getProjectsPageData();

  const researchProjects = projects.filter(({ type }) => type === 'research');
  const personalProjects = projects
    .filter(({ type }) => type === 'personal')
    .slice(0, FEATURED_PROJECTS_LIMIT);

  return (
    <main className="">
      <section className="-mt-[100px] mb-[160px] pt-[100px] px-6 pb-4 md:grid md:grid-cols-12 md:gap-x-4 bg-maverick-500">
        <div className="mt-16 md:col-start-1 md:col-span-12 lg:col-start-2 lg:col-span-10 space-y-4 text-on-primary">
          <div className="text-display-medium">My Projects</div>
          <div className="text-headline-large">
            I build tools to help me learn and to solve problems.
          </div>
        </div>
        <div className="-mb-[160px] pt-16 md:col-start-1 md:col-span-12 lg:col-start-2 lg:col-span-10 space-y-4">
          <div className="text-headline-medium text-on-primary">
            Spotlight Projects
          </div>
          <div className="columns-3">
            <SpotlightProjectCard project={personalProjects[0]} />
            <SpotlightProjectCard project={personalProjects[1]} />
            <SpotlightProjectCard project={personalProjects[2]} />
          </div>
        </div>
      </section>
      <section
        id="research-projects"
        className="py-[16px] lg:py-[64px] md:px-[16px] lg:grid lg:grid-cols-12 lg:px-[24px] lg:gap-x-[16px]"
      >
        <div className="mb-4 px-[20px] md:px-4 md:pb-4 lg:px-0 lg:mb-0 lg:col-span-2 lg:col-start-2">
          <div className="lg:sticky lg:top-[140px]">
            <div className="inline-block space-y-4">
              <h1 className="font-bold font-display text-2xl">
                Research Projects
              </h1>
              <p className="font-display">
                I tend to work on research projects that address larger themes
                or questions. These research projects are more open-ended.
              </p>
            </div>
            <div className="mt-4 font-display font-semibold">
              See all of my research projects{' '}
              <Link
                href="/research"
                className="underline hover:text-primary transition"
              >
                here
              </Link>
              .
            </div>
          </div>
        </div>
        <div className="md:px-4 lg:col-span-9 2xl:col-span-8 snap-y">
          <ProjectList projects={researchProjects} />
        </div>
      </section>
      <section
        id="personal-projects"
        className="py-[16px] lg:py-[64px] md:px-[16px] lg:grid lg:grid-cols-12 lg:px-[24px] lg:gap-x-[16px] bg-secondary text-on-light"
      >
        <div className="mb-4 px-[20px] md:px-4 md:pb-4 lg:px-0 lg:mb-0 lg:col-span-2 lg:col-start-2">
          <div className="lg:sticky lg:top-[140px]">
            <div className="inline-block space-y-4">
              <h1 className="font-bold font-display text-2xl">
                Personal Projects
              </h1>
              <p className="font-display">
                These projects come out of a desire to make things I would want
                to use. Most of them are web-based.
              </p>
              <p className="font-display">
                These projects aren&apos;t trying to discover anything new as
                much as they are just trying to be useful.
              </p>
            </div>
            <div className="mt-4 font-display font-semibold">
              See all of my projects{' '}
              <Link
                href="/projects/all"
                className="underline hover:text-primary transition"
              >
                here
              </Link>
              .
            </div>
          </div>
        </div>
        <div className="md:px-4 lg:col-span-9 2xl:col-span-8 snap-y">
          <ProjectList projects={personalProjects} />
        </div>
      </section>
      <section
        id="media-projects"
        className="py-[16px] lg:py-[64px] lg:px-[16px] lg:grid lg:grid-cols-12 xl:px-[24px] lg:gap-x-[16px] bg-primary text-on-dark"
      >
        <div className="px-[20px] py-8 md:px-4 md:py-4 lg:px-0 lg:mb-0 lg:col-start-2 lg:col-span-6 space-y-8">
          <div className="font-bold font-display text-display-large">
            Looking for media initiatives?
          </div>
          <LinkButton href="/media">See them here.</LinkButton>
        </div>
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
async function getProjectsPageData(): Promise<ProjectsPageProps> {
  try {
    const projects = await getProjects();
    return { projects };
  } catch (error) {
    console.error('Could not fetch projects', error);
    throw error;
  }
}
