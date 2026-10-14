import { themeSchemes } from '../theme/tokens';

/**
 * The single source of truth for the site's identity.
 *
 * Every hostname, site name, author detail, and social profile lives here so
 * that switching the canonical origin or the host is one edit. Do not
 * hardcode `willie.page` or `williecubed.me` anywhere else.
 */
/**
 * Every address the site shows, set per deployment. The defaults are the
 * live mailboxes, so a build with neither variable set still has working
 * links. They are public (the pages print them), so they carry the
 * NEXT_PUBLIC_ prefix and reach client components too.
 */
const emails = {
  /** The general address for the author, footer, security contact, and feeds. */
  hello: process.env.NEXT_PUBLIC_EMAIL_HELLO || 'hello@willie.page',
  /** For questions about a project in the archive. */
  projects: process.env.NEXT_PUBLIC_EMAIL_PROJECTS || 'projects@willie.page',
};

const THREADS_PROFILE = 'https://www.threads.com/@williecubed';

/**
 * The site owner's AT Protocol identity, from the environment. With no DID,
 * the AT Protocol features turn off: /.well-known/atproto-did answers 404
 * and there is no Bluesky account to link or syndicate to.
 */
const atproto = {
  did: process.env.NEXT_PUBLIC_ATPROTO_DID || undefined,
  /** Shown beside the account; the DID stands in when it is unset. */
  handle: process.env.NEXT_PUBLIC_BLUESKY_HANDLE || undefined,
};
const BLUESKY = 'https://bsky.app/';
/** Linked by DID, not handle, so the link outlives a handle change. */
const blueskyAccount = atproto.did
  ? ({
      service: 'Bluesky',
      serviceUrl: BLUESKY,
      handle: atproto.handle ?? atproto.did,
      profile: `${BLUESKY}profile/${atproto.did}`,
    } as const)
  : undefined;

// The homepage headline, and the rest of the site description after it.
const HEADLINE = 'Willie Chalmers III builds software and systems for people.';
const LEDE =
  'He runs Las Vegans for Better Transit, the design lab Hypertext Studio, and the Reasonable Tech Company.';

export const site = {
  name: 'Willie Chalmers III',
  shortName: 'WillieCubed',
  origin:
    process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/+$/, '') ||
    'https://willie.page',
  description: `${HEADLINE} ${LEDE}`,
  shortDescription: HEADLINE,
  /** The description minus the headline, for a card that already shows it. */
  lede: LEDE,
  locale: 'en_US',
  language: 'en',
  /** Dates on the site read in this zone whatever zone the server runs in. */
  timeZone: 'America/Los_Angeles',
  themeColor: themeSchemes.light.surface,
  themeColors: {
    light: themeSchemes.light.surface,
    dark: themeSchemes.dark.surface,
  },
  ogImage: '/brand/social/og-image.png',
  emails,
  author: {
    name: 'Willie Chalmers III',
    givenName: 'Willie',
    familyName: 'Chalmers',
    handle: 'willie',
    email: emails.hello,
    photo: '/brand/social/avatar-400.png',
    atprotoDid: atproto.did,
  },
  /** Profiles that link back here. Every one of these carries rel="me". */
  social: [
    {
      label: 'LinkedIn',
      href: 'https://www.linkedin.com/in/willie-chalmers-iii',
    },
    { label: 'GitHub', href: 'https://github.com/WillieCubed' },
    { label: 'Threads', href: THREADS_PROFILE },
    { label: 'Instagram', href: 'https://www.instagram.com/williecubed' },
    ...(blueskyAccount
      ? [{ label: 'Bluesky', href: blueskyAccount.profile }]
      : []),
  ],
  /** Accounts a Micropub client may choose with mp-syndicate-to. */
  syndication: [
    ...(blueskyAccount ? [blueskyAccount] : []),
    {
      service: 'Threads',
      serviceUrl: 'https://www.threads.com/',
      handle: '@williecubed',
      profile: THREADS_PROFILE,
    },
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

export const spotifyProfileUrl =
  'https://open.spotify.com/user/pkj37ts4e7ip19j0msai6lahf?si=03c8cb2eae944363';
