import { get } from '@vercel/edge-config';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next/types';
import './landing.css';
import nowIcon from '@/assets/list_alt.svg';
import bioIcon from '@/assets/patient_list.svg';
import randomIcon from '@/assets/draw_collage.svg';
import { SocialContactChip } from '../components/landing/SocialContactChip';
import { getFeaturedProjects } from '../lib/projects';
import FeaturedWorkCard from '../components/FeaturedProject';
import FeaturedProjectsList from '../components/landing/FeaturedProjectsList';
import FeaturedProjectsIcon from '../components/icons/FeaturedProjectsIcon';
import FeaturedWorkIcon from '../components/icons/FeaturedWorkIcon';
import InstagramIcon from '../components/icons/InstagramIcon';
import LinkedinIcon from '../components/icons/LinkedinIcon';
import NotesIcon from '../components/icons/NotesIcon';
import ThreadsIcon from '../components/icons/ThreadsIcon';
import { LinkButton } from '../components/LinkButton';
import { getFeaturedWork } from '../lib/projects';

export const metadata: Metadata = {
  title: {
    absolute: 'Willie Chalmers III',
  },
  openGraph: {
    title: 'Home',
    // TODO: Update this to be dynamic with some cool stats
    description:
      'Willie Chalmers III is a student studying computer science at The University of Texas at Dallas. Learn more about him and his projects here.',
    url: '/',
    type: 'website',
    images: ['/assets/headshot.jpg'],
  },
};

/**
 * The main entrypoint to the site.
 *
 * Route: /
 */
export default async function LandingPage() {
  const featuredProjects = await getFeaturedProjects();
  const featuredWork = await getFeaturedWork();
  const shouldShowWritings = await get('show_writings');

  return (
    <div className="p-lg pb-2xl desktop:pb-[128px]">
      <main className="max-w-breakpoint-2xl mx-auto tablet:grid tablet:grid-cols-8 tablet:gap-lg">
        <div className="hero-fold h-full tablet:col-span-5">
          <section className="md:px-4 md:col-start-1 md:col-end-10 lg:col-start-3 xl:col-end-11">
            <div className="mt-[96px] space-y-4">
              <div className="text-display-medium font-display">Hello!</div>
              <div className="text-display-medium font-display">
                I&apos;m <span className="text-primary">Willie</span>.
              </div>
            </div>
            <div className="mt-6 space-y-4">
              <div className="text-headline-large font-display">
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
          <section className="mt-8 lg:mt-24 md:col-span-5" id="spotlight">
            <div className="flex px-3 py-4 items-center gap-x-3 self-stretch">
              <FeaturedWorkIcon />
              <h1 className="text-headline-small font-bold font-display">
                Current Work
              </h1>
            </div>
            <FeaturedWorkCard
              title={featuredWork.title}
              tagline={featuredWork.tagline}
              description={featuredWork.description}
              timePeriod={featuredWork.timePeriod}
              mainLink={`https://github.com/ConnieML/Connie-RTC/`}
              caseStudyLink={`/case-studies/${featuredWork.projectId}`}
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
                    className="flex items-center h-10 gap-x-2 group rounded-lg group-hover:bg-slate-300 icon-link"
                  >
                    <Image
                      src={nowIcon}
                      alt=""
                      width={24}
                      height={24}
                      className="group-hover:"
                    />
                    <span>See what I&apos;m working on</span>
                  </Link>
                </li>
                <li className="text-on-surface">
                  <Link href="/bio" className="flex items-center h-10 gap-x-2">
                    <Image src={bioIcon} alt="" width={24} height={24} />
                    <span>Learn more about me</span>
                  </Link>
                </li>
                <li className="text-on-surface">
                  <Link
                    href="/random"
                    className="flex items-center h-10 gap-x-2"
                  >
                    <Image src={randomIcon} alt="" width={24} height={24} />
                    <span>See something random</span>
                  </Link>
                </li>
              </ul>
            </div>
            <div className="flex flex-col space-y-lg">
              <h1 className="font-semibold font-display text-title-large">
                Quick contacts
              </h1>
              <div className="flex items-end flex-wrap space-r-lg space-y-sm">
                <SocialContactChip
                  href="https://threads.net/@williecubed"
                  icon={
                    <ThreadsIcon className="group-hover:stroke-primary text-on-surface-foreground" />
                  }
                  label="Threads"
                />
                <SocialContactChip
                  href="https://instagram.com/williecubed"
                  icon={
                    <InstagramIcon className="group-hover:stroke-primary text-on-surface-foreground" />
                  }
                  label="Instagram"
                />
                <SocialContactChip
                  href="https://www.linkedin.com/in/willie-chalmers-iii"
                  icon={
                    <LinkedinIcon className="group-hover:stroke-primary text-on-surface-foreground" />
                  }
                  label="LinkedIn"
                />
              </div>
            </div>
          </section>
        </div>
        <section id="projects" className="md:col-span-5">
          <div className="flex px-4 py-4 items-center gap-x-3 self-stretch">
            <FeaturedProjectsIcon />
            <h1 className="text-headline-small font-bold font-display">
              Selected Projects
            </h1>
          </div>
          <div className="space-y-md">
            <FeaturedProjectsList projects={featuredProjects} />
            <LinkButton href={''} label="See the rest" icon={<></>} />
          </div>
        </section>
        {shouldShowWritings && (
          <section id="writings" className="md:col-span-5">
            <div className="flex px-4 py-4 items-center gap-x-3 self-stretch">
              <NotesIcon />
              <h1 className="text-headline-small font-bold font-display">
                Some Writings
              </h1>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
