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
  /** The ventures Willie runs, for structured data. */
  ventures: [
    {
      key: 'lvbt',
      name: 'Las Vegans for Better Transit',
      url: 'https://lasvegasfortransit.org/',
    },
    {
      key: 'hypertext',
      name: 'Hypertext Studio',
      url: 'https://hypertext.studio/',
    },
    {
      key: 'rtc',
      name: 'Reasonable Tech Company',
      url: 'https://reasonabletech.co/',
    },
  ],
  /** Hostnames that redirect into the canonical origin. */
  legacyHosts: ['williecubed.me', 'www.williecubed.me', 'www.willie.page'],
  /** Subdomains that redirect to a path on the canonical origin. */
  aliasHosts: {
    'tour.willie.page': '/initiatives/fall-tour-2026',
    'diaries.willie.page': '/initiatives/twd',
  },
} as const;

export interface SitePage {
  path: string;
  label: string;
  /** The hover card's description once the page is routed. */
  description: string;
  /** False while the page is parked in app/_(pages) for a rebuild. */
  routed: boolean;
  changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority: number;
}

/**
 * Every top-level page. When a parked page is rebuilt and its folder moves
 * out of app/_(pages), set `routed` to true here: the footer links, the
 * sitemap, the hover-card registry, and the 404's rebuilt note all read
 * this list.
 */
export const sitePages: SitePage[] = [
  {
    path: '/writings',
    label: 'Writings',
    description:
      'Thoughts, tutorials, and notes on software, music, and creativity.',
    routed: true,
    changeFrequency: 'daily',
    priority: 0.9,
  },
  {
    path: '/initiatives',
    label: 'Initiatives',
    description:
      'The campaigns, series, and projects Willie is running right now.',
    routed: true,
    changeFrequency: 'weekly',
    priority: 0.9,
  },
  {
    path: '/about',
    label: 'About',
    description: 'Who Willie is, what he has done, and where he is going.',
    routed: false,
    changeFrequency: 'yearly',
    priority: 0.75,
  },
  {
    path: '/apps',
    label: 'Apps',
    description: 'The apps Willie has shipped.',
    routed: false,
    changeFrequency: 'monthly',
    priority: 0.3,
  },
  {
    path: '/colophon',
    label: 'Colophon',
    description: 'How this site is made.',
    routed: false,
    changeFrequency: 'yearly',
    priority: 0.3,
  },
  {
    path: '/contact',
    label: 'Contact',
    description: "How to get in touch with Willie. It's pretty simple.",
    routed: false,
    changeFrequency: 'yearly',
    priority: 0.6,
  },
  {
    path: '/media',
    label: 'Media',
    description: 'The Willie Diaries and other creative work.',
    routed: false,
    changeFrequency: 'monthly',
    priority: 0.6,
  },
  {
    path: '/now',
    label: 'Now',
    description: "What Willie is working on and what's coming up next.",
    routed: false,
    changeFrequency: 'weekly',
    priority: 0.5,
  },
  {
    path: '/projects',
    label: 'Projects',
    description: 'Apps and other things Willie has built.',
    routed: false,
    changeFrequency: 'monthly',
    priority: 0.9,
  },
  {
    path: '/random',
    label: 'Random',
    description: 'A page picked at random.',
    routed: false,
    changeFrequency: 'yearly',
    priority: 0.1,
  },
];

/** The top-level pages a visitor can open. */
export const routedPages = sitePages.filter((page) => page.routed);

/**
 * True when a path belonged to a page that is parked while it is rebuilt.
 */
export function isParkedPath(path: string): boolean {
  return sitePages.some(
    (page) =>
      !page.routed && (path === page.path || path.startsWith(`${page.path}/`))
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
  /** Site-relative or absolute image URL for social cards (1200×630). */
  image?: string;
  /**
   * Alt text for the social image. Defaults to the title, or to the site
   * tagline when the page uses the site card.
   */
  imageAlt?: string;
  type?: 'website' | 'article' | 'profile';
  noIndex?: boolean;
  /** Article fields. Only used when `type` is 'article'. */
  publishedTime?: Date | string;
  modifiedTime?: Date | string;
  tags?: string[];
  section?: string;
  /** Label and value pairs Slack shows under the link preview (first two). */
  labels?: Array<[label: string, value: string]>;
}

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

/** Slack shows up to two label and value pairs under a link preview. */
function slackLabels(labels: Array<[string, string]>): Record<string, string> {
  return Object.fromEntries(
    labels.slice(0, 2).flatMap(([label, value], index) => [
      [`twitter:label${index + 1}`, label],
      [`twitter:data${index + 1}`, value],
    ])
  );
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
  imageAlt,
  type = 'website',
  noIndex = false,
  publishedTime,
  modifiedTime,
  tags,
  section,
  labels,
}: PageMetadataInput): Metadata {
  // Next.js replaces a parent's openGraph and twitter objects wholesale
  // when a page sets its own, so the site-level fields are repeated here.
  // Next.js 16 does not inject a nested segment's opengraph-image file
  // into a page that sets openGraph itself, so entity pages pass their
  // image route explicitly and everything else falls back to the site card.
  const url = image ?? site.ogImage;
  const alt = imageAlt ?? (image ? title : site.shortDescription);
  const shared = {
    siteName: site.name,
    locale: site.locale,
    title,
    description,
    url: path,
    images: [{ url, width: 1200, height: 630, alt }],
  };
  const openGraph: Metadata['openGraph'] =
    type === 'article'
      ? {
          ...shared,
          type,
          authors: [absoluteUrl('/')],
          ...(publishedTime ? { publishedTime: toIso(publishedTime) } : {}),
          ...(modifiedTime ? { modifiedTime: toIso(modifiedTime) } : {}),
          ...(tags && tags.length > 0 ? { tags } : {}),
          ...(section ? { section } : {}),
        }
      : { ...shared, type };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url, alt }],
    },
    ...(labels && labels.length > 0 ? { other: slackLabels(labels) } : {}),
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
