export interface SitePage {
  path: string;
  label: string;
  /** The hover card's description once the page is routed. */
  description: string;
  /** False while the page is parked for a rebuild. */
  routed: boolean;
}

/**
 * Every top-level page. When a parked page is rebuilt and routed again,
 * set `routed` to true here: the footer links, the
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
  },
  {
    path: '/initiatives',
    label: 'Initiatives',
    description:
      'The campaigns, series, and projects Willie is running right now.',
    routed: true,
  },
  {
    path: '/media',
    label: 'Media',
    description: 'Media mentions and appearances by Willie Chalmers III.',
    routed: true,
  },
  {
    path: '/brand',
    label: 'Brand',
    description:
      'The WillieCubed mark, lockups, app icons, and color and type tokens to download.',
    routed: true,
  },
  {
    path: '/sitemap',
    label: 'Sitemap',
    description: 'Browse pages, writings, initiatives, and feeds.',
    routed: true,
  },

  {
    path: '/colophon',
    label: 'Colophon',
    description: 'How this site is made.',
    routed: false,
  },
  {
    path: '/contact',
    label: 'Contact',
    description: "How to get in touch with Willie. It's pretty simple.",
    routed: false,
  },
  {
    path: '/now',
    label: 'Now',
    description: "What Willie is working on and what's coming up next.",
    routed: false,
  },
  {
    path: '/projects',
    label: 'Projects',
    description: 'Apps and other things Willie has built.',
    routed: true,
  },
  {
    path: '/random',
    label: 'Random',
    description: 'A page picked at random.',
    routed: false,
  },
];

/** A top-level page by path. Throws so a renamed page fails the build. */
export function sitePage(path: string): SitePage {
  const page = sitePages.find((item) => item.path === path);
  if (!page) throw new Error(`No site page at ${path}`);
  return page;
}

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
