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
import './site.css';

const PAGES = [
  { label: 'Now', href: '/now' },
  { label: 'Writings', href: '/writings' },
  { label: 'Initiatives', href: '/initiatives' },
  { label: 'Projects', href: '/projects' },
  { label: 'Colophon', href: '/colophon' },
];

const ELSEWHERE: { label: string; href: string; icon: IconName }[] = [
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

const LINK =
  'inline-flex items-center gap-2 py-1 text-label-large text-ink transition-colors hover:text-accent';

/**
 * The end of every page: who this is, the way back to the main pages,
 * the feeds, and where else to find Willie.
 */
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__top">
          <div className="space-y-3">
            <p className="text-headline-small font-semibold text-ink">
              {site.name}
            </p>
            <Suspense fallback={<p className="text-title-large">&nbsp;</p>}>
              <Tagline />
            </Suspense>
          </div>
          <nav aria-label="Pages" className="site-footer__pages">
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {PAGES.map((page) => (
                <li key={page.href}>
                  <SiteLink preview={false} href={page.href} className={LINK}>
                    {page.label}
                  </SiteLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        {/* This row never wraps. When the column gets narrow the labels
            drop and the icons stay, so the row degrades instead of folding. */}
        <div className="site-footer__row">
          <FeedsButton />
          <ul className="site-footer__profiles">
            {site.social.map((profile) => (
              <li key={profile.href}>
                <a href={profile.href} rel="me" className={LINK}>
                  <SocialIcon label={profile.label} />
                  <span className="site-footer__label">{profile.label}</span>
                </a>
              </li>
            ))}
            {ELSEWHERE.map((place) => (
              <li key={place.href}>
                <a href={place.href} className={LINK}>
                  <Icon name={place.icon} size={16} />
                  <span className="site-footer__label">{place.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
