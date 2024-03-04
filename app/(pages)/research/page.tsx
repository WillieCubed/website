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
      <div className="bg-maverick-800">
        <section className="max-w-breakpoint-2xl mx-auto tablet:grid tablet:grid-cols-8 tablet:gap-lg -mt-[100px] pt-[100px] px-lg pb-16">
          <div className="tablet:col-start-2 tablet:col-span-6 mt-16 space-y-lg text-on-primary">
            <div className="text-display-medium">My Research</div>
            <div className="text-headline-large">
              My research interests include machine perception, multimodal
              models, and machine understanding.
            </div>
          </div>
        </section>
      </div>
      <main className="p-lg  max-w-breakpoint-2xl mx-auto tablet:grid tablet:grid-cols-8 tablet:gap-lg">
        {/* <section id="projects" className="tablet:col-start-3 tablet:col-span-6 py-6">
          {' '}
        </section> */}
        <section
          id="questions"
          className="tablet:col-start-3 tablet:col-span-6 py-6"
        >
          <div className="prose dark:prose-invert">
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
                className="underline text-primary-dark-2 dark:text-primary-light-1"
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
    // <main>
    //   <section
    //     id="overview"
    //     className="py-4 lg:py-8 bg-accent-light-1 text-on-dark dark:bg-blue-800 dark:text-on-dark"
    //   >
    //     <div className="px-4 max-w-6xl mx-auto">
    //       <h1 className="mt-4 lg:mt-8 mb-4 text-display-large font-semibold font-display">
    //         Research
    //       </h1>
    //       <h2 className="mt-4 mb-4 text-display-medium font-semibold font-display">
    //         My Interests
    //       </h2>
    //       <div className="text-xl font-display">
    //         TL;DR: I&apos;m broadly interested in building intelligent agents
    //         that enable humans to do work more efficiently.
    //       </div>

    //       <div className="font-display text-xl my-4">
    //         Some topics of interest include:
    //       </div>
    //       <ul className="space-y-2 list-disc pl-8">
    //         <li className="">
    //           <h3 className="text-lg font-display font-medium">
    //             Natural Language Understanding
    //           </h3>
    //         </li>
    //         <li className="">
    //           <h3 className="text-lg font-display font-medium">
    //             Computer Vision
    //           </h3>
    //         </li>
    //         <li className="">
    //           <h3 className="text-lg font-display font-medium">
    //             Knowledge Representation
    //           </h3>
    //         </li>
    //         <li className="">
    //           <h3 className="text-lg font-display font-medium">
    //             Machine Perception
    //           </h3>
    //         </li>
    //         <li className="">
    //           <h3 className="text-lg font-display font-medium">
    //             Multimodal Models
    //           </h3>
    //         </li>
    //       </ul>
    //     </div>
    //   </section>
    //   <section id="experience" className="py-4 dark:bg-slate-800">
    //     <div className="px-4 max-w-5xl mx-auto">
    //       <h2 className="mt-4 mb-4 text-display-medium font-semibold font-display">
    //         Experience
    //       </h2>
    //       <div className="text-xl font-display">
    //         To date, I have worked in two labs.
    //       </div>
    //       <div className="lg:flex lg:space-x-4 space-y-4 py-4">
    //         <article className="flex-1 p-2 lg:p-4 border-2 border-black bg-white dark:bg-dark text-on-light dark:text-on-dark">
    //           <div className="text-primary text-xl font-display font-semibold">
    //             Research Intern,{' '}
    //             <a href="https://cei.utdallas.edu/polycraft-world/">
    //               Center for Engineering Innovation - UT Dallas
    //             </a>
    //           </div>
    //           <div className="text-slate-600 dark:text-slate-300 text-lg font-display">
    //             September 2019 - December 2021
    //           </div>
    //           <div className="">Contributions:</div>
    //           <ul className="list-disc pl-6">
    //             <li>
    //               Created developer tools for Polycraft World, a mod to the
    //               video game Minecraft
    //             </li>
    //             <li>
    //               Evaluated reinforcement learning environments to architect
    //               Polycraft AI Lab, a learning environment designed to simulate
    //               novelty in embodied automonous agents
    //             </li>
    //             <li>
    //               Developed a platform for testing reinforcement leraning agents
    //               as part of a DARPA-funded grant (SAIL-ON)
    //             </li>
    //           </ul>
    //         </article>
    //         <article className="flex-1 p-2 lg:p-4 border-2 border-black bg-white dark:bg-dark text-on-light dark:text-on-dark">
    //           <div className="text-primary text-xl font-display font-semibold">
    //             Research Assistant, Intelligent Robotics and Vision Lab - UT
    //             Dallas
    //           </div>
    //           <div className="text-slate-600 dark:text-slate-300 text-lg font-display">
    //             September 2019 - December 2021
    //           </div>
    //           <div className="">Contributions:</div>
    //           <ul className="list-disc pl-6">
    //             <li>
    //               Leading the Concept Learning Project, an initaitive to create
    //               a system that cna learn abstract concepts from data in
    //               self-supervised manner
    //             </li>
    //             <li>
    //               Developing vision-language model to learn cross-modal concepts
    //             </li>
    //             <li>Presented to lab paper reading group on Transformers</li>
    //           </ul>
    //         </article>
    //       </div>
    //     </div>
    //   </section>
    //   <section id="questions" className="py-4">
    //     <div className="px-4 max-w-5xl mx-auto">
    //       <h2 className="mt-4 mb-4 text-display-medium font-semibold font-display">
    //         Questions
    //       </h2>
    //       <div className="text-xl font-display">
    //         I like to organize my research along questions with specific themes.
    //         They&apos;re mostly AI-related (for now, at least)!
    //       </div>
    //       <h3 className="my-6 text-display-small">
    //         What is the nature of intelligence?
    //       </h3>
    //       <p className="text-lg">
    //         There are several competing definitions of intelligence, so this
    //         question is an open-ended exploration seeking to understand why
    //         it&apos;s so hard to choose a definition and what we can do once we
    //         know what intelligence is.
    //       </p>
    //       <h3 className="my-6 text-display-small">
    //         How can knowledge be shared between AI systems?
    //       </h3>
    //       <p className="text-lg">
    //         Right now, foundation models like GPT-3 are very useful at
    //         generating new data, but the knowledge within these systems are
    //         embedded in weights that do not have semantic meaning. From transfer
    //         learning to newer methods like{' '}
    //         <a href="http://" target="_blank" rel="noopener noreferrer"></a>{' '}
    //         RLHF use human judgement to &quot;transfer&quot; knowledge between
    //         successive versions of models, but we don&apos;t have easy ways of,
    //         for example, sharing specific facts from one LLM to another one
    //         trained on a wholly different architecture.
    //       </p>
    //       <p className="mt-2 text-lg">
    //         I believe the field will see a boom in activity from hobbists and
    //         researchers with limited resources after we solve this problem. Once
    //         AI R&amp;D becomes less about architecture and more about the
    //         learned knowledge, I believe it will be come much more valuable to
    //         the average person.
    //       </p>
    //       <h3 className="my-6 text-display-small">
    //         How does higher-order reasoning arise from lower-order functions?
    //       </h3>
    //       <p className="text-lg">
    //         Some in the field of AI debate on the extent to which symbols are
    //         necessary to perform reasoning, but answering this question requires
    //         an understanding of the mechanisms. Researchers like Chris Olah{' '}
    //         <a
    //           className="underline text-primary-dark-2 dark:text-primary-light-1"
    //           href="https://distill.pub/2018/building-blocks/"
    //           target="_blank"
    //           rel="noopener noreferrer"
    //         >
    //           [1]
    //         </a>{' '}
    //         are doing great work in interpretability, but we still don&apos;t
    //         entirely know how emergent behaviors arise from neural networks. I
    //         believe understanding thies will help us solve the engineering
    //         problems in AI.
    //       </p>
    //       <h3 className="my-6 text-display-small">
    //         In what ways is the architecture of the human brain applicable in
    //         designing intelligent systems?
    //       </h3>
    //       <p className="text-lg">
    //         Because the human brain is an organ that evolved to help our
    //         ancestors become better hunters and gatherers, I do not believe it
    //         is necessary to replicate all of the all of its functionality to
    //         create intelligent systems. However, some modules (like vision) seem
    //         to be useful in creating modules for AI (like convolutional neural
    //         networks).
    //       </p>
    //       <p className="mt-2 text-lg">
    //         How do these pieces fit together? Who knows!
    //       </p>
    //     </div>
    //   </section>
    // </main>
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
