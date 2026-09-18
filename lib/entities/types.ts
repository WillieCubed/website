/** What a hover card needs to know about a page on this site. */
export interface EntityCard {
  /** Site-relative path, no trailing slash, no query or hash. */
  href: string;
  kind:
    | 'page'
    | 'writing'
    | 'project'
    | 'initiative'
    | 'part'
    | 'venture'
    | 'product';
  title: string;
  description: string;
  cover?: { src: string; alt: string };
  /** A `#rrggbb` seed for the Material scheme the card takes on. */
  brand?: string;
  /** One short line of context, such as a date or "Part 2 of 4". */
  meta?: string;
}
