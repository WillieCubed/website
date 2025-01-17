import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';

// import ProjectNextIcon from '@/components/projects/ProjectNextIcon';
import LinkedObjectWrapper from '@/components/LinkedObjectWrapper';
// import TableOfContents from '@/components/TableOfContents';
import ProjectBackIcon from '@/components/projects/ProjectBackIcon';

import { ProjectData } from '@/lib/common';
import { getProject, getProjectSlugs } from '@/lib/projects';

import ProjectDetailView from './ProjectDetailsView';

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}/projects`
  : 'https://williecubed.me/projects';

/**
 * Generate a canonical URL for a project's meta social information.
 */
function generateProjectUrl(codename: string) {
  return `${BASE_URL}/${codename}`;
}

export const dynamic = 'force-static';

/**
 * Head for the /projects/[codename] route.
 *
 * This injects OpenGraph Project tags with information specific to the project
 * with the given codename.
 */
export async function generateMetadata(props: {
  params: Promise<{ codename: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const { codename } = params;
  try {
    const { project } = await getProject(codename);
    const canonicalUrl = generateProjectUrl(project.codename);
    return {
      title: `${project.title} Project Info`,
      description: project.tagline,
      alternates: {
        canonical: canonicalUrl,
      },
      openGraph: {
        siteName: 'Willie Chalmers III',
        title: project.title,
        description: project.tagline,
        url: canonicalUrl,
        // TODO: Choose a different image for a project
      },
    };
  } catch (e) {
    return {
      title: 'Unknown Project Info',
      description:
        "There's supposed to be a project here, but we can't seem to find the info!",
    };
  }
}

/**
 * Generate valid codename params for route.
 *
 * @returns An array of all possible codenames for projects
 */
export async function generateStaticParams() {
  const projects = await getProjectSlugs();
  return projects.map((codename) => ({
    codename,
  }));
}

interface ProjectDetailPageProps {
  params: Promise<{
    codename: string;
  }>;
}

/**
 * A page that shows extended information about a project.
 * Route: /projects/<codename>
 */
export default async function ProjectDetailPage(props: ProjectDetailPageProps) {
  const params = await props.params;

  const { codename } = params;

  let mdxSource, project;
  try {
    const projectData = await getProject(codename);
    mdxSource = projectData.mdxSource;
    project = projectData.project as ProjectData;
  } catch (e) {
    return redirect('/404');
  }

  const projectInfo = {
    nextProject: 'LogDate',
    nextProjectId: 'logdate',
  };

  const { nextProject, nextProjectId } = projectInfo;

  const quarter = Math.floor(project.launched.getMonth() / 3) + 1;

  return (
    <div className="min-h-[75vh]">
      <div className="surface-alt bordered-b -mt-[128px] pt-[176px]">
        <section
          id="hero"
          className="min-[960px]:gridded max-w-breakpoint-2xl mx-auto space-y-lg desktop:space-y-0 tablet:gap-x-lg pb-lg tablet:pb-16 px-lg desktop-large:px-0"
        >
          <div className="relative size-24 *:desktop:row-span-1 col-start-1 mb-xl">
            {project.projectIconUrl ? (
              <Image
                src={project.projectIconUrl}
                alt={`${project.title} logo`}
                className="bordered flex flex-col justify-center object-cover surface-alt dark:bg-slate-800 text-display-small text-center"
                fill
              />
            ) : (
              <div className="bordered flex flex-col justify-center h-full w-full surface-alt dark:bg-slate-800 text-display-small text-center">
                {project.title[0]}
              </div>
            )}
          </div>
          <div className="row-start-2 col-start-1 col-span-4">
            <div className="h-full flex flex-col justify-between">
              <div className="space-y-md">
                <div className="text-on-surface text-title-large">
                  Project Overview
                </div>
                <div className="text-primary text-display-medium desktop:text-display-large">
                  {project.title}
                </div>
                <div className="mt-xl text-headline-small">
                  {project.tagline}
                </div>
              </div>
              <div className="space-y-lg mt-2xl mb-xl tablet:my-0">
                <div className="flex justify-between">
                  <div className="space-y-md">
                    <div className="text-title-large">Launched</div>
                    <div className="text-title-medium">
                      {project.launched.getFullYear()}Q{quarter}
                    </div>
                  </div>
                </div>
                <div className="space-y-lg tablet:space-y-0 tablet:flex tablet:space-x-lg tablet:*:w-[50%]">
                  <div className="space-y-md">
                    <div className="text-headline-small">Roles</div>
                    <div className="text-title-medium">
                      {project.roles.join(', ')}
                    </div>
                  </div>
                  <div className="space-y-md">
                    <div className="text-headline-small">Current Contact</div>
                    <div>
                      <div className="text-title-medium">
                        {project.contact.name}
                      </div>
                      <div className="text-title-small hover:underline focus:underline underline-offset-4">
                        <a href={`mailto:${project.contact.email}`}>
                          {project.contact.email}
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bordered relative self-end aspect-[4/3] tablet:aspect-[3/2] desktop-large:aspect-video row-start-3 min-[960px]:row-start-2 min-[960px]:col-start-5 tablet:col-span-4 bg-maverick-300 text-on-surface">
            {project.thumbnail ? (
              <Image
                className="desktop-large:aspect-video object-cover h-48 w-96"
                src={project.thumbnail}
                alt={`Screenshot of ${project.title}`}
                fill
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full w-full text-title-large">
                Coming soon!
              </div>
            )}
          </div>
        </section>
      </div>
      <main className="max-w-breakpoint-2xl mx-auto gridded desktop:gap-x-lg px-lg desktop-large:px-0 py-8 space-y-xl desktop:space-y-0 desktop:gap-y-xl">
        {/* TODO: Re-enable table of contents once functional */}
        {/* <aside className="tablet:row-start-1 tablet:col-start-8 tablet:sticky tablet:top-[100px]">
          <TableOfContents items={[]} />
        </aside> */}
        <section className="space-y-lg tablet:row-start-1 tablet:col-start-1 tablet:col-span-7">
          {project.website && (
            <LinkedObjectWrapper href={project.website}>
              View project here
            </LinkedObjectWrapper>
          )}
          <ProjectDetailView
            compiledSource={mdxSource.compiledSource}
            scope={mdxSource.scope}
            frontmatter={mdxSource.frontmatter}
          />
        </section>
        <section id="nav" className="col-span-8">
          <div className="flex justify-between">
            <div id="back" className="w-[142px]">
              <Link href="/projects" className="group">
                <div className="space-y-sm">
                  <div>
                    <ProjectBackIcon />
                  </div>
                  <div className="text-label-large group-hover:underline group-hover:underline-offset-4">
                    Back to all projects
                  </div>
                </div>
              </Link>
            </div>
            {/* TODO: Re-enable once functionality can work */}
            {/* <div id="next" className="space-y-2 w-[164px]">
              <Link
                href={`/projects/${nextProjectId}`}
                className="group "
              >
                <div>
                  <ProjectNextIcon />
                </div>
                <div className="space-y-2">
                  <div className="text-label-large ">Next project</div>
                  <div className="text-title-medium group-hover:underline group-hover:underline-offset-4">{nextProject}</div>
                </div>
              </Link>
            </div> */}
          </div>
        </section>
      </main>
    </div>
  );
}
