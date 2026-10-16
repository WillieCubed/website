import { Suspense } from 'react';

import BlueskyIcon from '@/components/icons/BlueskyIcon';
import Icon, { type IconName } from '@/components/icons/Icon';
import InstagramIcon from '@/components/icons/InstagramIcon';
import LinkedinIcon from '@/components/icons/LinkedinIcon';
import SpotifyIcon from '@/components/icons/SpotifyIcon';
import ThreadsIcon from '@/components/icons/ThreadsIcon';
import SiteLink from '@/components/link/SiteLink';
import LiveStatus from '@/components/status/LiveStatus';

import { spotifyProfileUrl } from '@/lib/site/identity';
import { site } from '@/lib/site/identity';
import { routedPages } from '@/lib/site/navigation';
import { randomlyChooseTagline, taglineHref } from '@/lib/site/taglines';
import { isPrivatePreview } from '@/lib/studio/config';

import FeedsButton from './FeedsButton';
import FooterFrame from './FooterFrame';
import FooterLockup from './FooterLockup';
import Webrings from './Webrings';
import './site.css';

/**
 * Brand stays available by direct link without promotion in the footer.
 * Search opens the command palette. Its trigger submits to /search when
 * scripts cannot run.
 */
const PAGES = routedPages
  .filter((page) => page.path !== '/brand')
  .map((page) => ({
    label: page.label,
    href: page.path,
  }));

const WORK_PATHS = ['/writings', '/projects', '/initiatives', '/media'];
const PROFILE_PATHS = ['/about', '/research', '/sitemap'];

function pagesAt(paths: string[]) {
  return paths.flatMap((path) => PAGES.filter((page) => page.href === path));
}

const FOOTER_PAGES = [
  ...pagesAt(WORK_PATHS),
  ...pagesAt(PROFILE_PATHS),
  // Newly routed pages remain reachable before they receive a position.
  ...PAGES.filter(
    (page) => ![...WORK_PATHS, ...PROFILE_PATHS].includes(page.href)
  ),
];

const ELSEWHERE: {
  label: string;
  href: string;
  icon: IconName | 'spotify';
}[] = [
  {
    label: 'Email',
    href: `mailto:${site.author.email}?subject=Hello%20Willie!`,
    icon: 'mail',
  },
  {
    label: 'Spotify',
    href: spotifyProfileUrl,
    icon: 'spotify',
  },
];

function SocialIcon({ label }: { label: string }) {
  switch (label) {
    case 'Bluesky':
      return <BlueskyIcon className="size-4" />;
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

async function currentTagline(): Promise<string> {
  return randomlyChooseTagline();
}

async function Tagline() {
  const tagline = await currentTagline();
  const href = taglineHref(tagline);
  return (
    <p className="text-body-medium text-muted text-balance">
      {href ? (
        // A plain anchor: the target is a route handler, not a page the
        // router can render, so it takes a full navigation.
        <a
          href={href}
          className="site-footer__tagline-link transition-colors hover:text-accent"
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
          <div className="site-footer__brand">
            <FooterLockup name={site.name} />
            <div className="site-footer__brand-detail">
              <Suspense fallback={<p className="text-body-medium">&nbsp;</p>}>
                <Tagline />
              </Suspense>
            </div>
          </div>
          <div className="site-footer__navigation">
            <nav aria-label="Pages" className="site-footer__pages">
              <ul aria-label="Site">
                {FOOTER_PAGES.map((page) => (
                  <li key={page.href}>
                    <SiteLink preview={false} href={page.href} className={LINK}>
                      {page.label}
                    </SiteLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
        {/* This row never wraps. When the column gets narrow the labels
            drop and the icons stay, so the row degrades instead of folding.
            The contact links come first, on screen and in tab order alike:
            on the homepage they are the row the footer grows out of. */}
        <div className="site-footer__row">
          <ul className="site-footer__profiles" data-footer-contact>
            {ELSEWHERE.map((place) => (
              <li key={place.href}>
                <SiteLink href={place.href} className={LINK}>
                  {place.icon === 'spotify' ? (
                    <SpotifyIcon className="size-4" />
                  ) : (
                    <Icon name={place.icon} size={16} />
                  )}
                  <span className="site-footer__label">{place.label}</span>
                </SiteLink>
              </li>
            ))}
            {site.social.map((profile, index) => (
              // The row is the homepage's footer while it is collapsed, and
              // only so much of it fits the rail's column: the ones past the
              // first few wait until the footer opens.
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
          <Suspense fallback={null}>
            <LiveStatus />
          </Suspense>
          {!isPrivatePreview() && <FeedsButton />}
        </div>
        <Webrings />
      </div>
    </FooterFrame>
  );
}
