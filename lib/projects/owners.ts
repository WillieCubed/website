/**
 * The organizations a project can belong to. A project lists these keys in
 * `owners`; a project with none is Willie's own. `brand` is a key in
 * lib/brand/seeds.json, and an owner without one keeps its projects neutral.
 */
export interface Owner {
  name: string;
  href?: string;
  brand?: string;
}

export const OWNERS = {
  lvbt: {
    name: 'Las Vegans for Better Transit',
    href: 'https://lasvegasfortransit.org/',
    brand: 'lvbt',
  },
  hypertext: {
    name: 'Hypertext Studio',
    href: 'https://hypertext.studio/',
    brand: 'hypertext',
  },
  rtc: {
    name: 'Reasonable Tech Company',
    href: 'https://reasonabletech.co/',
    brand: 'lovelace',
  },
  acm: { name: 'ACM UTD', href: 'https://github.com/acmutd' },
  asa: { name: 'American Society on Aging', href: 'https://www.asaging.org/' },
  nebula: { name: 'Nebula Labs', href: 'https://www.utdnebula.com/' },
  irvl: { name: 'IRVL', href: 'https://github.com/IRVLUTD' },
} as const satisfies Record<string, Owner>;

export type OwnerKey = keyof typeof OWNERS;

export const OWNER_KEYS = Object.keys(OWNERS) as [OwnerKey, ...OwnerKey[]];
