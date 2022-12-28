import Link from 'next/link';
import LinkButton from '../../components/LinkButton';
import ProjectList from '../../components/ProjectList';
import { getProjects, ProjectData } from '../../lib/projects';

/**
 * A page showing off all of my projects
 *
 * Route: /projects
 */
export default async function ProjectsPage() {
  const { projects } = await getProjectsPageData();

  const researchProjects = projects.filter(({ type }) => type === 'research');
  const personalProjects = projects.filter(({ type }) => type === 'personal');

  return (
    <main className="">
      <section
        id="research-projects"
        className="py-[16px] lg:py-[64px] lg:px-[16px] lg:grid lg:grid-cols-12 lg:px-[24px] lg:gap-x-[16px]"
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
        className="py-[16px] lg:py-[64px] lg:px-[16px] lg:grid lg:grid-cols-12 lg:px-[24px] lg:gap-x-[16px] bg-secondary text-on-light"
      >
        <div className="mb-4 px-[20px] md:px-4 md:pb-4 lg:px-0 lg:mb-0 lg:col-span-2 lg:col-start-2">
          <div className="lg:sticky lg:top-[140px]">
            <div className="inline-block space-y-4">
              <h1 className="font-bold font-display text-2xl">
                Personal Projects
              </h1>
              <p className="font-display">
                These projects come out of a desire to make things I would
                want to use. Most of them are web-based.
              </p>
              <p className="font-display">
                These projects aren&apos;t trying to discover anything new as
                much as they are just trying to be useful.
              </p>
            </div>
            <div className="mt-4 font-display font-semibold">
              See all of my research projects{' '}
              <Link
                href="/projects"
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
        className="py-[16px] lg:py-[64px] lg:px-[16px] lg:grid lg:grid-cols-12 lg:px-[24px] lg:gap-x-[16px] bg-primary text-on-dark"
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
};

type ProjectsPageProps = {
  projects: ProjectData[];
};

/**
 * A wrapper function taht 
 *
 * @returns 
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
