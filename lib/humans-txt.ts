import { site } from '@/lib/site';

/**
 * What the site is built with, by package name in package.json. A unit
 * test fails when one of these leaves package.json, so the list cannot
 * name a library the site no longer uses.
 */
export const HUMANS_COMPONENTS: Array<[pkg: string, name: string]> = [
  ['next', 'Next.js'],
  ['react', 'React'],
  ['tailwindcss', 'Tailwind CSS'],
  ['@mdx-js/react', 'MDX'],
  ['@material/material-color-utilities', 'Material Color Utilities'],
  ['framer-motion', 'Motion'],
  ['shiki', 'Shiki'],
  ['pagefind', 'Pagefind'],
  ['zod', 'Zod'],
  ['date-fns', 'date-fns'],
  ['microformats-parser', 'microformats-parser'],
];

/** Only what the site serves today: drop one when its route or markup goes. */
export const HUMANS_STANDARDS = [
  'HTML',
  'CSS',
  'microformats2',
  'Webmention',
  'Micropub',
  'IndieAuth',
  'WebSub',
  'RSS',
  'Atom',
  'JSON Feed',
  'schema.org JSON-LD',
  'Open Graph',
  'oEmbed',
  'WebFinger',
  'OpenSearch',
  'security.txt (RFC 9116)',
  'HTCPCP (RFC 2324, RFC 7168)',
  'Model Context Protocol',
  'llms.txt',
];

/** `2026/09/27`, the date format humanstxt.org uses, in the site's zone. */
function humansDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: site.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .replaceAll('-', '/');
}

/**
 * The site's humans.txt (humanstxt.org): who made it and what it is made
 * with. `builtAt` is when this deployment was built; without it the
 * Last update line is left out rather than guessed.
 */
export function buildHumansTxt(builtAt?: Date): string {
  const lines = [
    '/* TEAM */',
    `Developer: ${site.author.name}`,
    `Site: ${site.origin}`,
    `Contact: ${site.emails.hello}`,
    '',
    '/* SITE */',
    ...(builtAt ? [`Last update: ${humansDate(builtAt)}`] : []),
    'Language: English',
    'Doctype: HTML5',
    `Standards: ${HUMANS_STANDARDS.join(', ')}`,
    `Components: ${HUMANS_COMPONENTS.map(([, name]) => name).join(', ')}`,
    '',
  ];
  return lines.join('\n');
}
