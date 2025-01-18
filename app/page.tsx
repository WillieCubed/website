import clsx from 'clsx';
import Link from 'next/link';
import type { Metadata } from 'next/types';
import { type JSX, PropsWithChildren } from 'react';

import FeaturedWorkCard from '@/components/FeaturedProject';
import { LinkButton } from '@/components/LinkButton';
import BioPageIcon from '@/components/icons/BioPageIcon';
import FeaturedProjectsIcon from '@/components/icons/FeaturedProjectsIcon';
import FeaturedWorkIcon from '@/components/icons/FeaturedWorkIcon';
import InstagramIcon from '@/components/icons/InstagramIcon';
import LinkedinIcon from '@/components/icons/LinkedinIcon';
import NotesIcon from '@/components/icons/NotesIcon';
import NowPageIcon from '@/components/icons/NowPageIcon';
import RandomPageIcon from '@/components/icons/RandomPageIcon';
import ThreadsIcon from '@/components/icons/ThreadsIcon';
import FeaturedProjectsList from '@/components/landing/FeaturedProjectsList';
import FeaturedWritingsList from '@/components/landing/FeaturedWritingsList';
import { SocialContactChip } from '@/components/landing/SocialContactChip';

import { REMOTE_CONFIG_KEYS, fetchConfig } from '@/lib/config';
import { getFeaturedProjects, getFeaturedWork } from '@/lib/projects';
import { getFeaturedWritings } from '@/lib/writings';

import './landing.css';

export const metadata: Metadata = {
  title: {
    absolute: 'Willie Chalmers III',
  },
  openGraph: {
    // TODO: Update this to be dynamic with some cool stats
    description:
      'Willie Chalmers III builds software for people. Learn more about him and his projects here.',
    url: '/',
    type: 'website',
  },
};

interface TileButtonProps {
  variant?: 'primary' | 'tonal' | 'text';
  href?: string;
  className?: string;
}

function TileButton({
  variant = 'primary',
  href = '#',
  className,
  children,
}: PropsWithChildren<TileButtonProps>) {
  return (
    <Link
      className={clsx(
        variant === 'primary' && 'bg-primary text-on-primary',
        variant === 'tonal' &&
          'bg-secondary-container text-on-secondary-container',
        className
      )}
      href={href}
    >
      {children}
    </Link>
  );
}

/**
 * The main entrypoint to the site.
 *
 * Route: /
 */
export default async function LandingPage() {
  // const allFeaturedProjects = await getFeaturedProjects();
  // const featuredWork = await getFeaturedWork();
  // const featuredWritings = await getFeaturedWritings();
  // const shouldShowWritings = await fetchConfig(REMOTE_CONFIG_KEYS.showWritings);

  // // Sort in reverse chronological order
  // const featuredProjects = allFeaturedProjects.sort(
  //   (p1, p2) => p2.launched.getTime() - p1.launched.getTime()
  // );

  return (
    <div>
      <main className="mx-auto max-w-2xl p-lg">
        <div className="mt-3xl space-y-lg">
          <div className="font-display text-display-medium">willie is...</div>
          <div className="font-display text-headline-medium">
            Currently building{' '}
            <Link
              className="text-primary hover:underline hover:text-primary-container transition ease-in"
              href="https://reasonabletech.co"
            >
              Project Newton
            </Link>
          </div>
        </div>
        <div className="mt-3xl prose text-on-surface prose-a:text-primary hover:prose-a:text-primary-container transition ease-in">
          <p className="">
            Willie Chalmers III is the founder of the Reasonable Tech Company, a
            little startup focused on building intelligent software to make your
            life easier.
          </p>
          <p>
            Previously, he worked with the American Society on Aging to
            prototype a digital communications platform for helping
            community-based organizations stay in touch with older American
            adults.
          </p>
          <p>
            Before that, Willie founded and led Nebula Labs, an organization
            that builds tools to support students&apos; academic success.
          </p>
          <p>
            Willie got his bachelor&apos;s degree in computer science from The
            University of Texas at Dallas, where he managed{' '}
            <Link href="https://acmutd.co">several</Link>{' '}
            <Link href="https://aisutd.org">student</Link>{' '}
            <Link href="https://sg.utdallas.edu">organizations</Link>, working
            with over a hundred student leaders, impacting thousands of
            students.
          </p>
          <p>
            Find him on{' '}
            <Link href="https://threads.net/@williecubed">Threads</Link> or
            email him at{' '}
            <Link href="mailto:contact@williecubed.me">
              contact@williecubed.me
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
    // <div className="grid desktop:grid-cols-8">
    //   <section
    //     id="hero"
    //     className="desktop:col-span-8 desktop:grid desktop:grid-cols-subgrid"
    //   >
    //     <div className="desktop:col-span-4 pt-[128px] px-xl pb-xl space-y-xl">
    //       <div className="space-y-lg">
    //         <div className="text-display-medium 2xl:text-display-large">
    //           I&apos;m Willie.
    //         </div>
    //         <div className="text-display-small 2xl:text-display-medium">
    //           I <span className="text-primary">build software</span> for{' '}
    //           <span className="text-tertiary">humans</span>.
    //         </div>
    //       </div>
    //       <div className="text-headline-small text-on-surface-variant">
    //         Currently working an app to help people document and share their
    //         memories.
    //       </div>
    //       <div className="text-title-small text-on-surface-variant">
    //         (among{' '}
    //         <Link href="https://reasonabletech.co" className="text-on-surface">
    //           other things
    //         </Link>
    //         )
    //       </div>
    //     </div>
    //     {/* <div className="desktop:col-span-4 content-end space-y-xl p-lg">
    //       <div className="text-label-large text-on-surface-variant">Places I&apos;m online</div>
    //     </div> */}
    //   </section>
    //   <section id="featured" className="desktop:col-span-8">
    //     <RowHeader icon={<FeaturedWorkIcon />} title="Featured Work" />
    //     <div className="flex">
    //       <div className="flex-1 border-r border-outline-variant bg-surface aspect-[16/9]"></div>
    //       <div className="h-full flex-1 flex flex-col">
    //         <div className="flex-1 flex flex-col justify-end p-lg space-y-xl">
    //           <div className="space-y-lg">
    //             <div className="text-display-small">{featuredWork.title}</div>
    //             <div className="text-headline-small">
    //               {featuredWork.tagline}
    //             </div>
    //           </div>
    //         </div>
    //         <div className="flex">
    //           <TileButton
    //             variant="primary"
    //             href="https://logdate.app"
    //             className="flex-1 p-lg"
    //           >
    //             <div className="text-label-large">Visit website</div>
    //           </TileButton>
    //           <TileButton
    //             variant="tonal"
    //             href="/projects/logdate"
    //             className="flex-1 p-lg"
    //           >
    //             <div className="text-label-large">Project Brief</div>
    //           </TileButton>
    //           <TileButton
    //             variant="tonal"
    //             href="https://github.com/WillieCubed/logdate-client"
    //             className="flex-1 p-lg"
    //           >
    //             <div className="text-label-large">View on GitHub</div>
    //           </TileButton>
    //         </div>
    //       </div>
    //     </div>
    //   </section>
    //   <section id="works">
    //     <RowHeader icon={<FeaturedWorkIcon />} title="Other Projects" />
    //   </section>
    //   {shouldShowWritings && (
    //     <section
    //       id="notes"
    //       className="col-span-8 lg:grid lg:grid-cols-6 xl:grid-cols-8"
    //     >
    //       <div className="p-lg space-x-md col-span-2">
    //         <div>I</div>
    //         <div className="space-y-md">
    //           <div className="text-headline-small">Notes</div>
    //           <div className="text-body-large">
    //             A few of my ideas and writings, all in one place.
    //           </div>
    //         </div>
    //       </div>
    //     </section>
    //   )}
    // </div>
  );
}

// interface WritingCardProps {
//   title: string;
//   description: string;
//   date: Date;
//   href: string;
// }

// function Writing({ title, description, date, href }: WritingCardProps) {
//   return <div></div>;
// }

// interface RowHeaderProps {
//   icon: JSX.Element;
//   title: string;
// }

// function RowHeader({ icon, title }: RowHeaderProps) {
//   return (
//     <div className="flex items-center space-x-sm p-lg border-b border-outline-variant">
//       <div className={clsx()}>{icon}</div>
//       <div className="text-headline-small">{title}</div>
//     </div>
//   );
// }
