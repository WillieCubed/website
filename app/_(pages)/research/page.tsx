import { Metadata } from 'next';

import { ProjectData } from '@/lib/common';
import { getAllProjects } from '@/lib/projects';

export const metadata: Metadata = {
  title: 'Research Overview',
  description:
    'Willie Chalmers III builds software for people. Learn more about him and his research interests here.',
  openGraph: {
    siteName: 'Willie Chalmers III',
    title: 'Research Overview',
    description:
      'Willie Chalmers III builds software for people. Learn more about him and his research interests here.',
  },
};

/**
 * A page containing an overview of my personal research program.
 *
 * Route: /research
 */
export default async function ResearchOverviewPage() {
  const { researchProjects: projects } = await getResearchPageData();

  return (
    <main className="">
      <div className="bg-surface-container-highest">
        <section className="max-w-breakpoint-2xl mx-auto tablet:grid tablet:grid-cols-8 tablet:gap-lg -mt-[100px] pt-[100px] px-lg pb-16">
          <div className="tablet:col-start-2 tablet:col-span-6 mt-16 space-y-lg text-on-surface">
            <div className="text-display-medium">My Research</div>
            <div className="text-headline-large">
              My research interests include machine perception, multimodal
              models, and machine understanding.
            </div>
          </div>
        </section>
      </div>
      <main className="p-lg max-w-breakpoint-2xl mx-auto tablet:grid tablet:grid-cols-8 tablet:gap-lg">
        <section
          id="questions"
          className="tablet:col-start-3 tablet:col-span-6 py-6"
        >
          <div className="prose prose-theme">
            <h2 className="mt-4 mb-4 text-display-small font-semibold font-display">
              My Open Questions
            </h2>
            <div className="text-xl font-display">
              I like to organize my research along questions with specific
              themes. They&apos;re mostly AI-related (for now, at least)!
            </div>
            <h3 className="my-6 text-headline-medium">
              What is the nature of intelligence?
            </h3>
            <p className="text-lg">
              There are several competing definitions of intelligence, so this
              question is an open-ended exploration seeking to understand why
              it&apos;s so hard to choose a definition and what we can do once
              we know what intelligence is.
            </p>
            <h3 className="my-6 text-headline-medium">
              How can knowledge be shared between AI systems?
            </h3>
            <p className="text-lg">
              Right now, foundation models like GPT-3 are very useful at
              generating new data, but the knowledge within these systems are
              embedded in weights that do not have semantic meaning. From
              transfer learning to newer methods like{' '}
              <a href="http://" target="_blank" rel="noopener noreferrer"></a>{' '}
              RLHF use human judgement to &quot;transfer&quot; knowledge between
              successive versions of models, but we don&apos;t have easy ways
              of, for example, sharing specific facts from one LLM to another
              one trained on a wholly different architecture.
            </p>
            <p className="mt-2 text-lg">
              I believe the field will see a boom in activity from hobbists and
              researchers with limited resources after we solve this problem.
              Once AI R&amp;D becomes less about architecture and more about the
              learned knowledge, I believe it will be come much more valuable to
              the average person.
            </p>
            <h3 className="my-6 text-headline-medium">
              How does higher-order reasoning arise from lower-order functions?
            </h3>
            <p className="text-lg">
              Some in the field of AI debate on the extent to which symbols are
              necessary to perform reasoning, but answering this question
              requires an understanding of the mechanisms. Researchers like
              Chris Olah{' '}
              <a
                className="underline text-primary"
                href="https://distill.pub/2018/building-blocks/"
                target="_blank"
                rel="noopener noreferrer"
              >
                [1]
              </a>{' '}
              are doing great work in interpretability, but we still don&apos;t
              entirely know how emergent behaviors arise from neural networks. I
              believe understanding thies will help us solve the engineering
              problems in AI.
            </p>
            <h3 className="my-6 text-headline-medium">
              In what ways is the architecture of the human brain applicable in
              designing intelligent systems?
            </h3>
            <p className="text-lg">
              Because the human brain is an organ that evolved to help our
              ancestors become better hunters and gatherers, I do not believe it
              is necessary to replicate all of the all of its functionality to
              create intelligent systems. However, some modules (like vision)
              seem to be useful in creating modules for AI (like convolutional
              neural networks).
            </p>
            <p className="mt-2 text-lg">
              How do these pieces fit together? Who knows!
            </p>
          </div>
        </section>
      </main>
    </main>
  );
}

type ProjectsPageProps = {
  researchProjects: ProjectData[];
};

/**
 * A wrapper function that provides data needed to render the projects overview.
 *
 * @returns All research projects
 */
async function getResearchPageData(): Promise<ProjectsPageProps> {
  try {
    const projects = await getAllProjects();
    const researchProjects = projects.filter(({ type }) => type === 'research');
    return { researchProjects };
  } catch (error) {
    console.error('Could not fetch projects', error);
    throw error;
  }
}
