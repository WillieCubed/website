import type { GetStaticProps, InferGetStaticPropsType, NextPage } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import LinkButton from '../../components/LinkButton';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import { getProjects, ProjectData, ProjectType } from '../../lib/projects';

const PROJECT_TYPE_MAP: Record<ProjectType, string> = {
  research: 'Research Project',
  personal: 'Personal Project',
};

function projectTagToColor(subject: string) {
  // TODO: Find an obviously better way of fixing this.
  switch (subject) {
    case 'Computer Vision':
      return '#FFD23F';
    case 'Natural Language Processing':
      return '#3BCEAC';
    default:
      return '#FFD23F';
  }
}

/**
 * A card that displays overview information about a project.
 *
 * This card displays as a block and relies on a parent to determine its sizing.
 */
function ProjectCard({
  codename,
  name,
  type,
  collaborators,
  subjects,
  overview,
  questions,
  artifacts,
}: ProjectData) {
  const typeLabel = PROJECT_TYPE_MAP[type];

  const collaboratorsItems = collaborators?.map(({ name, url }) => {
    return url ? (
      <Link href={url} className="underline font-mono font-semibold">
        {name}
      </Link>
    ) : (
      <span className="underline font-mono font-semibold">{name}</span>
    );
  });

  const questionsContent = questions.map(({ codename, content }) => {
    return <li key={codename}>{content}</li>;
  });

  const subjectTags = subjects.map((label) => {
    return (
      <span
        className="inline-block p-3 mr-2"
        style={{
          // TODO: Find a more efficient way of doing this
          backgroundColor: projectTagToColor(label) + '80',
        }}
      >
        {label}
      </span>
    );
  });

  const artifactsItems = artifacts.map(({ label, url, thumbnailUrl }) => {
    return (
      <Link href={url} className="inline-block p-3 bg-slate-300 text-on-light">
        <div className="font-mono font-semibold">{label}</div>
      </Link>
    );
  });

  return (
    <article className="p-[16px] lg:p-[32px] mb-4 border-[4px] border-black bg-white text-on-light dark:bg-dark dark:text-on-dark hover:shadow-lg transition snap-start">
      <div>
        <div className="uppercase font-bold font-display text-sm">
          {typeLabel}
        </div>
        <div className="mt-2 font-bold font-display text-display-large text-primary stroke">
          {name}
        </div>
      </div>
      <div className="mt-6 space-y-6">
        {collaborators && (
          <div className="space-y-2">
            <div className="uppercase font-bold font-display text-sm text-primary-dark-1">
              Collaborators
            </div>
            <div className="space-x-4">{collaboratorsItems}</div>
          </div>
        )}
        {subjects.length > 0 && (
          <div className="space-y-2">
            <div className="uppercase font-bold font-display text-sm text-primary-dark-1">
              Topics
            </div>
            <div className="space-y-2">{subjectTags}</div>
          </div>
        )}
        <div className="space-y-2">
          <div className="uppercase font-bold font-display text-sm text-primary-dark-1">
            Overview
          </div>
          <p className="font-semibold font-display">{overview}</p>
        </div>
        {questions.length > 0 && (
          <div className="space-y-2">
            <div className="uppercase font-bold font-display text-sm text-primary-dark-1">
              Questions Addressed
            </div>
            <ul className="space-y-2">{questionsContent}</ul>
          </div>
        )}
        {artifacts && (
          <div className="space-y-2">
            <div className="uppercase font-bold font-display text-sm text-primary-dark-1">
              Artifacts
            </div>
            <div className="space-x-4">{artifactsItems}</div>
          </div>
        )}
      </div>
      <div className="mt-4">
        <Link
          href={`/projects/${codename} `}
          className="underline font-bold font-display"
        >
          Learn more
        </Link>
      </div>
    </article>
  );
}

interface ProjectsListProps {
  projects: ProjectData[];
}

function ProjectList({ projects }: ProjectsListProps) {
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

const LandingPage: NextPage<InferGetStaticPropsType<typeof getStaticProps>> = ({
  projects,
}) => {
  const researchProjects = projects.filter(({ type }) => type === 'research');
  const personalProjects = projects.filter(({ type }) => type === 'personal');

  return (
    <>
      <Head>
        <title>Projects Overview - Willie Chalmers III</title>
        <meta
          name="description"
          content="Everything WillieCubed. See what projects he's working on."
        />
        <link rel="icon" href="/favicon.ico" />

        <meta property="og:site_name" content="Willie Chalmers III" />
        <meta property="og:title" content="Projects Overview" />
        <meta
          property="og:description"
          content="Willie Chalmers III is a student studying computer science at The University of Texas at Dallas and doing research in artficial intelligence. See what he's working on here."
        />
        <meta property="og:image" content="/assets/headshot.jpg" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://williecubed.me/projects" />
      </Head>

      {/* TODO: Figure out how to intelligently hide header on load */}
      <SiteHeader showTitle={true} />

      <main className="">
        <section
          id="research-projects"
          className="py-[16px] lg:py-[64px] lg:px-[16px] lg:grid lg:grid-cols-12 lg:px-[24px] lg:gap-x-[16px] bg-[#E1E5F2] text-on-light"
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

      <SiteFooter />
    </>
  );
};

type ProjectsPageProps = {
  projects: ProjectData[];
};

export const getStaticProps: GetStaticProps<ProjectsPageProps> = async (
  context
) => {
  try {
    const projects = await getProjects();
    return {
      props: {
        projects,
      },
    };
  } catch (error) {
    console.error('Could not fetch projects', error);
    return {
      props: {
        projects: [],
      },
    };
  }
};

export default LandingPage;
