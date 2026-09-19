import type { Metadata } from 'next';

/**
 * The single source of truth for the site's identity.
 *
 * Every hostname, site name, author detail, and social profile lives here so
 * that switching the canonical origin or the host is one edit. Do not
 * hardcode `willie.page` or `williecubed.me` anywhere else.
 */
export const site = {
  name: 'Willie Chalmers III',
  shortName: 'WillieCubed',
  origin: 'https://willie.page',
  description:
    'Willie Chalmers III builds software and systems for people. He runs Las Vegans for Better Transit, the design lab Hypertext Studio, and the Reasonable Tech Company.',
  shortDescription:
    'Willie Chalmers III builds software and systems for people.',
  locale: 'en_US',
  language: 'en',
  /** Dates on the site read in this zone whatever zone the server runs in. */
  timeZone: 'America/Los_Angeles',
  themeColor: '#f4f5ef',
  ogImage: '/brand/social/og-image.png',
  author: {
    name: 'Willie Chalmers III',
    givenName: 'Willie',
    familyName: 'Chalmers',
    handle: 'willie',
    email: 'hello@williecubed.me',
    photo: '/brand/social/avatar-400.png',
    atprotoDid: 'did:plc:iyn6nc3ffqm2e3555exyrgvv',
  },
  /** Profiles that link back here. Every one of these carries rel="me". */
  social: [
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/in/willie-chalmers-iii',
    },
    { label: 'GitHub', href: 'https://github.com/WillieCubed' },
    { label: 'Threads', href: 'https://threads.net/@williecubed' },
    { label: 'Instagram', href: 'https://instagram.com/williecubed' },
  ],
  /** Hostnames that redirect into the canonical origin. */
  legacyHosts: ['williecubed.me', 'www.williecubed.me', 'www.willie.page'],
  /** Subdomains that redirect to a path on the canonical origin. */
  aliasHosts: {
    'tour.willie.page': '/initiatives/fall-tour-2026',
    'diaries.willie.page': '/initiatives/twd',
  },
  /**
   * Paths that belonged to pages now parked in app/_(pages) while they are
   * rebuilt. The 404 page tells visitors with old links that the page is
   * coming back. Remove a path when its page is routed again.
   */
  parkedPaths: [
    '/about',
    '/apps',
    '/colophon',
    '/contact',
    '/media',
    '/now',
    '/projects',
    '/random',
  ],
} as const;

/**
 * True when a path belonged to a page that is parked while it is rebuilt.
 */
export function isParkedPath(path: string): boolean {
  return site.parkedPaths.some(
    (parked) => path === parked || path.startsWith(`${parked}/`)
  );
}

/**
 * A calendar date the way the author saw it. Writing dates carry a Pacific
 * offset, and formatting them in the server's own zone shifted the day on
 * Vercel.
 */
export function formatDate(
  date: Date | string | number,
  month: 'long' | 'short' = 'long'
): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: site.timeZone,
    year: 'numeric',
    month,
    day: 'numeric',
  }).format(new Date(date));
}

/**
 * True for paths on this site, including absolute URLs on the canonical
 * origin. Lives here rather than in the link component so server code can
 * use it too.
 */
export function isInternalHref(href: string): boolean {
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  return href.startsWith(site.origin);
}

/** Absolute URL for a path on the canonical origin. */
export function absoluteUrl(path = '/'): string {
  return new URL(path, site.origin).toString();
}

/**
 * Tagged template for absolute site URLs.
 *
 * @example absoluteRoute`/writings/${slug}`
 */
export function absoluteRoute(
  strings: TemplateStringsArray,
  ...values: Array<string | number>
): string {
  let path = '';
  strings.forEach((part, index) => {
    path += part;
    if (values[index] !== undefined) path += String(values[index]);
  });
  return absoluteUrl(path || '/');
}

export interface PageMetadataInput {
  /** The bare page title, without the site name. */
  title: string;
  description: string;
  /** Site-relative path used for the canonical and og:url. */
  path: string;
  /** Site-relative or absolute image URL for social cards. */
  image?: string;
  type?: 'website' | 'article' | 'profile';
  noIndex?: boolean;
}

/**
 * Build page metadata that keeps the site name out of the OpenGraph title.
 *
 * Next.js copies the templated document title into og:title unless the page
 * sets openGraph.title itself, so this helper always sets it to the bare
 * title. The document title still gets the "· Willie Chalmers III" suffix from
 * the root template for platforms that never show og:site_name.
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
  type = 'website',
  noIndex = false,
}: PageMetadataInput): Metadata {
  // Next.js replaces a parent's openGraph and twitter objects wholesale
  // when a page sets its own, so the site-level fields are repeated here.
  // Next.js 16 does not inject a nested segment's opengraph-image file
  // into a page that sets openGraph itself, so entity pages pass their
  // image route explicitly and everything else falls back to the site card.
  const images = [image ?? site.ogImage];
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      siteName: site.name,
      locale: site.locale,
      title,
      description,
      url: path,
      type,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images,
    },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
