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
import FooterFrame from './FooterFrame';
import FooterLockup from './FooterLockup';
import './site.css';

/**
 * Brand stays available by direct link without promotion in the footer.
 * Search lives in the command
 * palette; visitors whose scripts never ran find /search through the top
 * bar's <noscript> link instead.
 */
const PAGES = routedPages
  .filter((page) => page.path !== '/brand')
  .map((page) => ({
    label: page.label,
    href: page.path,
  }));

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

/** How many profiles the collapsed row keeps beside the email link. */
const KEPT = 2;

const LINK =
  'inline-flex items-center gap-2 py-1 text-label-large text-ink transition-colors hover:text-accent';

/**
 * The end of every page: who this is, the way back to the main pages, the
 * feeds, and where else to find Willie. On the homepage, which asks for it
 * by rendering DockFooter, this same footer is the rail's contact row until
 * the page ends and then opens out of it (FooterFrame).
 */
export default function SiteFooter() {
  return (
    <FooterFrame>
      <div className="site-footer__inner">
        <div className="site-footer__top">
          <div className="site-footer__brand space-y-3">
            <FooterLockup name={site.name} />
            <Suspense fallback={<p className="text-body-medium">&nbsp;</p>}>
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
            drop and the icons stay, so the row degrades instead of folding.
            The contact links come first, on screen and in tab order alike:
            on the homepage they are the row the footer grows out of. */}
        <div className="site-footer__row">
          <ul className="site-footer__profiles" data-footer-contact>
            {ELSEWHERE.map((place) => (
              <li key={place.href}>
                <a href={place.href} className={LINK}>
                  <Icon name={place.icon} size={16} />
                  <span className="site-footer__label">{place.label}</span>
                </a>
              </li>
            ))}
            {site.social.map((profile, index) => (
              // The row is the homepage's footer while it is collapsed, and
              // only so much of it fits the rail's column: the ones past the
              // first few wait until the footer opens (footer-dock.css).
              <li
                key={profile.href}
                data-extra={index >= KEPT ? '' : undefined}
              >
                <a href={profile.href} rel="me" className={LINK}>
                  <SocialIcon label={profile.label} />
                  <span className="site-footer__label">{profile.label}</span>
                </a>
              </li>
            ))}
          </ul>
          <FeedsButton />
        </div>
      </div>
    </FooterFrame>
  );
}
