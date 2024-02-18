import { get } from '@vercel/edge-config';
import Link from 'next/link';
import type { Metadata } from 'next/types';
import './landing.css';
import { getFeaturedProjects, getFeaturedWork } from '../lib/projects';
import { getFeaturedWritings } from '../lib/writings';
import { SocialContactChip } from '../components/landing/SocialContactChip';
import FeaturedWorkCard from '../components/FeaturedProject';
import FeaturedProjectsList from '../components/landing/FeaturedProjectsList';
import FeaturedWritingsList from '../components/landing/FeaturedWritingsList';
import FeaturedProjectsIcon from '../components/icons/FeaturedProjectsIcon';
import FeaturedWorkIcon from '../components/icons/FeaturedWorkIcon';
import InstagramIcon from '../components/icons/InstagramIcon';
import LinkedinIcon from '../components/icons/LinkedinIcon';
import NotesIcon from '../components/icons/NotesIcon';
import ThreadsIcon from '../components/icons/ThreadsIcon';
import { LinkButton } from '../components/LinkButton';
import NowPageIcon from '../components/icons/NowPageIcon';
import BioPageIcon from '../components/icons/BioPageIcon';
import RandomPageIcon from '../components/icons/RandomPageIcon';

export const metadata: Metadata = {
  title: {
    absolute: 'Willie Chalmers III',
  },
  openGraph: {
    siteName: 'Willie Chalmers III',
    // TODO: Update this to be dynamic with some cool stats
    description:
      'Willie Chalmers III builds software for people. Learn more about him and his projects here.',
    url: '/',
    type: 'website',
  },
};

/**
 * The main entrypoint to the site.
 *
 * Route: /
 */
export default async function LandingPage() {
  const allFeaturedProjects = await getFeaturedProjects();
  const featuredWork = await getFeaturedWork();
  const featuredWritings = await getFeaturedWritings();
  const shouldShowWritings = await get('show_writings');

  // Sort in reverse chronological order
  const featuredProjects = allFeaturedProjects.sort(
    (p1, p2) => p2.launched.getTime() - p1.launched.getTime()
  );

  return (
    <div className="p-lg pb-2xl desktop:pb-[128px]">
      <main className="max-w-breakpoint-2xl mx-auto tablet:grid tablet:grid-cols-8 tablet:gap-lg">
        <div className="hero-fold flex flex-col h-full tablet:col-span-6">
          <section className="flex-grow">
            <div className="mt-[48px] tablet:mt-[96px] space-y-4">
              <div className="text-display-small tablet:text-display-medium font-display">
                Hello!
              </div>
              <div className="text-display-small tablet:text-display-medium font-display">
                I&apos;m <span className="text-primary">Willie</span>.
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <div className="text-headline-medium tablet:text-headline-large font-display">
                I build{' '}
                <span
                  className="text-primary hover:underline cursor-pointer"
                  title="(create software that uses AI)"
                >
                  thoughtful software
                </span>{' '}
                to bring people together
                <br className="print:hidden" /> and aspire to{' '}
                <span
                  className="text-accent-dark-2 hover:underline cursor-pointer"
                  title="(search for the holy grail of artificial general intelligence)"
                >
                  study machine intelligence
                </span>
                .
              </div>
              <div className="max-w-[598px]">
                <div className="text-headline-small">
                  Currently a product manager for{' '}
                  <a
                    href="https://www.developforgood.org/"
                    className="text-maverick-400 hover:text-maverick-500 transition ease-linear underline"
                  >
                    Develop for Good
                  </a>{' '}
                  working with the{' '}
                  <a
                    href="https://www.asaging.org/"
                    className="text-maverick-400 hover:text-maverick-500 transition ease-linear underline"
                  >
                    American Society on Aging
                  </a>
                  .
                </div>
              </div>
            </div>
          </section>
          <section className="mt-8" id="spotlight">
            <div className="flex px-md py-lg items-center gap-x-md self-stretch">
              <FeaturedWorkIcon />
              <h1 className="text-headline-small font-bold font-display">
                Current Work
              </h1>
            </div>
            <FeaturedWorkCard
              id={featuredWork.projectId}
              title={featuredWork.title}
              tagline={featuredWork.tagline}
              description={featuredWork.description}
              timePeriod={featuredWork.timePeriod}
              mainLink={featuredWork.website}
              caseStudyLink={`/case-studies /${featuredWork.projectId}`}
              type={featuredWork.type}
            />
          </section>
        </div>
        <div className="hero-fold h-full tablet:pb-lg tablet:col-start-7 tablet:col-end-9 tablet:row-start-1">
          <section
            id="links"
            className="h-full flex flex-col justify-end bottom-0 inset-0 tablet:sticky tablet:top-24 pb-4 mt-xl space-y-8"
          >
            <div>
              <h1 className="font-semibold font-display text-title-large">
                Quick links
              </h1>
              <ul className="mt-2 flex flex-col items-start text-title-medium">
                <li className="text-on-surface">
                  <Link
                    href="/now"
                    className="flex items-center h-10 gap-x-sm group icon-link"
                  >
                    <NowPageIcon className="text-on-surface-foreground dark:text-on-surface-foreground-dark" />
                    <span className="group-hover:underline underline-offset-2">
                      See what I&apos;m working on
                    </span>
                  </Link>
                </li>
                <li className="text-on-surface">
                  <Link
                    href="/bio"
                    className="flex items-center h-10 gap-x-sm group icon-link"
                  >
                    <BioPageIcon className="text-on-surface-foreground dark:text-on-surface-foreground-dark" />
                    <span className="group-hover:underline underline-offset-2">
                      Learn more about me
                    </span>
                  </Link>
                </li>
                <li className="text-on-surface">
                  <Link
                    href="/random"
                    className="flex items-center h-10 gap-x-sm group icon-link"
                  >
                    <RandomPageIcon className="text-on-surface-foreground dark:text-on-surface-foreground-dark" />
                    <span className="group-hover:underline underline-offset-2">
                      See something random
                    </span>
                  </Link>
                </li>
              </ul>
            </div>
            <div className="flex flex-col space-y-lg">
              <h1 className="font-semibold font-display text-title-large">
                Quick contacts
              </h1>
              <div className="flex items-center h-10 gap-x-sm icon-link">
                <SocialContactChip
                  href="https://threads.net/@williecubed"
                  icon={
                    <ThreadsIcon className="text-on-surface-foreground dark:text-on-surface-foreground-dark" />
                  }
                  label="Threads"
                />
                <SocialContactChip
                  href="https://instagram.com/williecubed"
                  icon={
                    <InstagramIcon className="text-on-surface-foreground dark:text-on-surface-foreground-dark" />
                  }
                  label="Instagram"
                />
                <SocialContactChip
                  href="https://www.linkedin.com/in/willie-chalmers-iii"
                  icon={
                    <LinkedinIcon className="text-on-surface-foreground dark:text-on-surface-foreground-dark" />
                  }
                  label="LinkedIn"
                />
              </div>
            </div>
          </section>
        </div>
        <section id="projects" className="tablet:col-span-6">
          <div className="flex px-lg py-lg items-center gap-x-md self-stretch">
            <FeaturedProjectsIcon />
            <h1 className="text-headline-small font-bold font-display">
              Selected Projects
            </h1>
          </div>
          <div className="space-y-md">
            <FeaturedProjectsList projects={featuredProjects} />
            <LinkButton href="/projects" label="See the rest" icon={<></>} />
          </div>
        </section>
        {shouldShowWritings && (
          <section id="writings" className="tablet:col-span-6">
            <div className="flex px-lg py-lg items-center gap-x-md self-stretch">
              <NotesIcon />
              <h1 className="text-headline-small font-bold font-display">
                Some Writings
              </h1>
            </div>
            <div className="space-y-md">
              <FeaturedWritingsList writings={featuredWritings} />
              <LinkButton href="/writings" label="Read more" icon={<></>} />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
