import { cacheLife } from 'next/cache';
import { Suspense } from 'react';

import Icon, { type IconName } from '@/components/icons/Icon';
import InstagramIcon from '@/components/icons/InstagramIcon';
import LinkedinIcon from '@/components/icons/LinkedinIcon';
import ThreadsIcon from '@/components/icons/ThreadsIcon';
import SiteLink from '@/components/link/SiteLink';

import { randomlyChooseTagline, taglineHref } from '@/lib/enhancements';
import { routedPages, site } from '@/lib/site';

import FeedsButton from './FeedsButton';
import FooterLockup from './FooterLockup';
import './site.css';

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
 * page and its hydration agree on it. Only the text is cached, so a style
 * change never waits on the cache.
 */
async function hourlyTagline(): Promise<string> {
  'use cache';
  cacheLife('hours');
  return randomlyChooseTagline();
}

async function Tagline() {
  const tagline = await hourlyTagline();
  const href = taglineHref(tagline);
  return (
    <p className="text-body-medium text-muted">
      {href ? (
        // A plain anchor: the target is a route handler, not a page the
        // router can render, so it takes a full navigation.
        <a
          href={href}
          className="underline-offset-4 hover:text-accent hover:underline"
        >
          {tagline}
        </a>
      ) : (
        tagline
      )}
    </p>
  );
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
            <FooterLockup name={site.name} />
            <Suspense fallback={<p className="text-body-medium">&nbsp;</p>}>
              <Tagline />
            </Suspense>
          </div>
          <nav aria-label="Pages" className="site-footer__pages">
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {routedPages.map((page) => (
                <li key={page.path}>
                  <SiteLink preview={false} href={page.path} className={LINK}>
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
