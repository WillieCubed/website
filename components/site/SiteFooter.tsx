import { cacheLife } from 'next/cache';
import { Suspense } from 'react';

import Icon, { type IconName } from '@/components/icons/Icon';
import InstagramIcon from '@/components/icons/InstagramIcon';
import LinkedinIcon from '@/components/icons/LinkedinIcon';
import ThreadsIcon from '@/components/icons/ThreadsIcon';
import SiteLink from '@/components/link/SiteLink';

import { randomlyChooseTagline } from '@/lib/enhancements';
import { site } from '@/lib/site';

import FeedsButton from './FeedsButton';

const PAGES = [
  { label: 'Now', href: '/now' },
  { label: 'Writings', href: '/writings' },
  { label: 'Initiatives', href: '/initiatives' },
  { label: 'Projects', href: '/projects' },
  { label: 'Colophon', href: '/colophon' },
];

const ELSEWHERE: { label: string; href: string; icon: IconName }[] = [
  {
    label: 'Last.fm',
    href: 'https://www.last.fm/user/WillieCubed',
    icon: 'music',
  },
  {
    label: 'Spotify',
    href: 'https://open.spotify.com/user/pkj37ts4e7ip19j0msai6lahf',
    icon: 'music',
  },
  {
    label: 'Email',
    href: `mailto:${site.author.email}?subject=Hello%20Willie!`,
    icon: 'mail',
  },
];

function SocialIcon({ label }: { label: string }) {
  switch (label) {
    case 'Threads':
      return <ThreadsIcon className="size-4" />;
    case 'Instagram':
      return <InstagramIcon className="size-4" />;
    case 'LinkedIn':
      return <LinkedinIcon className="size-4" />;
    case 'GitHub':
      return <Icon name="github" size={16} />;
    default:
      return null;
  }
}

/**
 * The tagline changes once an hour rather than on every render, so the
 * page and its hydration agree on it.
 */
async function Tagline() {
  'use cache';
  cacheLife('hours');
  return <p className="text-title-large text-ink">{randomlyChooseTagline()}</p>;
}

const PILL =
  'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-label-large text-ink transition-colors hover:bg-card hover:text-accent';

/**
 * The end of every page: who this is, the way back to the main pages,
 * the feeds, and where else to find Willie.
 */
export default function SiteFooter() {
  return (
    <footer className="mt-24 bg-tray">
      <div className="mx-auto grid max-w-[1200px] gap-10 px-5 py-12 expanded:grid-cols-2">
        <div className="space-y-4">
          <p className="text-headline-small font-semibold text-ink">
            {site.name}
          </p>
          <Suspense fallback={<p className="text-title-large">&nbsp;</p>}>
            <Tagline />
          </Suspense>
          <FeedsButton />
        </div>
        <div className="space-y-6 expanded:justify-self-end">
          <nav aria-label="Pages">
            <ul className="-mx-3 flex flex-wrap gap-1 expanded:justify-end">
              {PAGES.map((page) => (
                <li key={page.href}>
                  <SiteLink preview={false} href={page.href} className={PILL}>
                    {page.label}
                  </SiteLink>
                </li>
              ))}
            </ul>
          </nav>
          <ul className="-mx-3 flex flex-wrap gap-1 expanded:justify-end">
            {site.social.map((profile) => (
              <li key={profile.href}>
                <a href={profile.href} rel="me" className={PILL}>
                  <SocialIcon label={profile.label} />
                  {profile.label}
                </a>
              </li>
            ))}
            {ELSEWHERE.map((place) => (
              <li key={place.href}>
                <a href={place.href} className={PILL}>
                  <Icon name={place.icon} size={16} />
                  {place.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
