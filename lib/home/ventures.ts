/**
 * Everything the homepage shows about Willie's ventures.
 *
 * Adding work to the homepage means adding an entry here; the grid packs new
 * tiles without a layout change. The markup lives in components/home and
 * reads these records, so nothing here carries HTML.
 */

export type Facet = 'software' | 'systems' | 'people';

/** A key into lib/brand/seeds.json. */
export type BrandKey =
  | 'lvbt'
  | 'logdate'
  | 'docket'
  | 'curfew'
  | 'lovelace'
  | 'atlas'
  | 'hypertext';

/**
 * A picture with its intrinsic size, so the page reserves its box before the
 * file arrives. The files are WebP; tests/unit/home-images.test.mts checks
 * that each one exists and matches the size given here.
 */
export interface Picture {
  src: string;
  width: number;
  height: number;
}

const A = '/assets/home/';
const picture = (name: string, width: number, height: number): Picture => ({
  src: `${A}${name}.webp`,
  width,
  height,
});

const TRANSITMAPPER = picture('transit-mapper', 1200, 630);
const TRANSITMAPPER_THUMB = picture('thumb-transitmapper', 144, 108);
const LVBT_HOME = picture('lvbt-home', 640, 400);
const LVBT_PROJECTS = picture('lvbt-projects', 640, 400);
const LOGDATE = picture('logdate-phone', 948, 1852);
const DOCKET = picture('docket-app', 1600, 928);
const CURFEW = picture('curfew-lockout', 1544, 960);
const LOVELACE_ADA = picture('lovelace-ada', 1350, 580);
const LOVELACE_HOME = picture('lovelace-home', 640, 400);
const LOVELACE_MEMORY = picture('lovelace-memory', 640, 400);

/** The LVBT countdown. The 2027 session opens on this date. */
export const LVBT_DEADLINE = '2027-02-01';
const LVBT_DEADLINE_CAPTION =
  'days until the 2027 session decides whether fifteen bus routes survive';

export interface DetailLink {
  label: string;
  href: string;
}

export interface DetailListItem {
  title: string;
  text: string;
  /** Another entry the item opens in place, such as a studio product. */
  opens?: string;
}

export type DetailMedia =
  | { kind: 'countdown'; deadline: string; caption: string }
  | (Picture & {
      kind: 'image';
      alt: string;
      /** Shown at 84% inside the panel with a shadow instead of edge to edge. */
      framed?: boolean;
      /** Anchor the cover crop to the left edge rather than the center. */
      fromLeft?: boolean;
    })
  | { kind: 'stack'; images: (Picture & { alt: string })[] }
  | { kind: 'constellation' };

export interface Detail {
  media: DetailMedia;
  /** Paragraphs, in order. */
  body: string[];
  list?: DetailListItem[];
  links: DetailLink[];
}

export interface Product {
  id: string;
  name: string;
  brand: BrandKey;
  parent: string;
  facets: Facet[];
  platform: string;
  copy: string;
  image: Picture;
  /** Always a screenshot, so the studio's detail view can reuse its alt text. */
  detail: Detail & { media: Extract<DetailMedia, { kind: 'image' }> };
}

export type TileBody =
  | {
      kind: 'lead';
      title: string;
      tagline: string;
      countdown: { deadline: string; caption: string };
      active: string[];
    }
  | (Picture & { kind: 'shot'; alt: string; low?: boolean })
  | { kind: 'products'; products: Product[] }
  | { kind: 'atlas'; copy: string };

export interface Venture {
  id: string;
  name: string;
  /** The tile label when it is not simply `parent · name`. */
  head?: string;
  brand: BrandKey;
  /** Position in the rail list. Ventures without one only get a tile. */
  list?: number;
  /**
   * Grid size classes such as `w3 h3`, plus any tile modifier. `full` spans
   * the whole row at the medium and expanded sizes too.
   */
  size: string;
  facets: Facet[];
  /** The chip that appears over the tile label on hover. */
  hint: string;
  /** The rail row's second line. */
  line?: string;
  /** Thumbnails for the rail row's fanning stack, back to front. */
  stack?: Picture[];
  parent?: string;
  body: TileBody;
  detail: Detail;
  /** Higher weights sort first in the grid. */
  weight: number;
  /**
   * Keeps an unfinished venture off the homepage: no tile, no rail row, and
   * no detail view. Its record stays here so removing the flag restores it.
   */
  hidden?: boolean;
}

export const products: Record<string, Product> = {
  logdate: {
    id: 'logdate',
    name: 'LogDate',
    brand: 'logdate',
    parent: 'Hypertext Studio',
    facets: ['software', 'people'],
    platform: 'iOS · Android',
    copy: 'A lifelog and social journal',
    image: LOGDATE,
    detail: {
      media: {
        kind: 'image',
        ...LOGDATE,
        alt: 'The LogDate timeline on a phone',
      },
      body: [
        'A lifelong journal for documenting, revisiting, and sharing your memories, with journals you can share with the people in them.',
      ],
      links: [{ label: 'Visit logdate.app', href: 'https://logdate.app/' }],
    },
  },
  docket: {
    id: 'docket',
    name: 'Docket',
    brand: 'docket',
    parent: 'Hypertext Studio',
    facets: ['software', 'systems'],
    platform: 'Web',
    copy: 'Planning and scheduling, with Athena',
    image: DOCKET,
    detail: {
      media: {
        kind: 'image',
        ...DOCKET,
        alt: "Docket's Today view with tasks and a calendar",
        framed: true,
      },
      body: [
        'One tool for planning, scheduling, and tracking every kind of work. Each task carries its estimate, its place on the calendar, and the hours it took. Athena, a digital chief of staff, is built in.',
      ],
      links: [
        { label: 'Visit Docket', href: 'https://docket.hypertext.studio/' },
      ],
    },
  },
  curfew: {
    id: 'curfew',
    name: 'Curfew',
    brand: 'curfew',
    parent: 'Hypertext Studio',
    facets: ['software', 'people'],
    platform: 'macOS',
    copy: 'A hard stop for your workday',
    image: CURFEW,
    detail: {
      media: {
        kind: 'image',
        ...CURFEW,
        alt: "Curfew's full-screen lockout reading 10:47 PM, that's the day",
      },
      body: [
        'Set your work hours. Curfew counts down when the day is over, then shows a full-screen lockout so you actually step away from your Mac.',
      ],
      links: [
        { label: 'Visit Curfew', href: 'https://curfew.hypertext.studio/' },
      ],
    },
  },
};

const productList = Object.values(products);

export const ventures: Venture[] = [
  {
    id: 'lvbt',
    name: 'Las Vegans for Better Transit',
    brand: 'lvbt',
    head: '',
    list: 1,
    size: 'w3 h3 lvbt',
    facets: ['systems', 'people'],
    hint: 'See what’s active',
    line: 'TransitMapper and organizing',
    stack: [TRANSITMAPPER_THUMB, LVBT_PROJECTS, LVBT_HOME],
    weight: 100,
    body: {
      kind: 'lead',
      title: 'Las Vegans for Better Transit',
      tagline: 'Building the public transit movement Las Vegas has never had.',
      countdown: { deadline: LVBT_DEADLINE, caption: LVBT_DEADLINE_CAPTION },
      active: [
        'Week Without Driving',
        'State legislator outreach',
        'Urbanism Book Club',
      ],
    },
    detail: {
      media: {
        kind: 'countdown',
        deadline: LVBT_DEADLINE,
        caption: LVBT_DEADLINE_CAPTION,
      },
      body: [
        'Las Vegans for Better Transit is a nonprofit that organizes riders and neighbors into a constituency the Legislature has to answer to.',
      ],
      list: [
        {
          title: 'Week Without Driving',
          text: 'A one-week challenge to take at least one trip without a car and share how it went.',
        },
        {
          title: 'State legislator outreach',
          text: 'Relationships in Carson City to win dedicated RTC funding in the 2027 session.',
        },
        {
          title: 'Urbanism Book Club',
          text: 'A reading group on transit, housing, streets, and city politics.',
        },
      ],
      links: [
        {
          label: 'Visit lasvegasfortransit.org',
          href: 'https://lasvegasfortransit.org/',
        },
        {
          label: 'All LVBT projects',
          href: 'https://lasvegasfortransit.org/projects/',
        },
      ],
    },
  },
  {
    id: 'transitmapper',
    name: 'TransitMapper',
    brand: 'lvbt',
    parent: 'Las Vegans for Better Transit',
    size: 'w3 h3',
    facets: ['software', 'systems'],
    hint: 'See how it works',
    weight: 80,
    body: {
      kind: 'shot',
      ...TRANSITMAPPER,
      alt: 'TransitMapper showing a sample Las Vegas transit network on a street map',
      low: true,
    },
    detail: {
      media: {
        kind: 'image',
        ...TRANSITMAPPER,
        alt: 'TransitMapper showing a sample Las Vegas transit network on a street map',
        fromLeft: true,
      },
      body: [
        'Sketch routes on a real street map, place stops and stations, and see how a transit system would operate. It’s one of the public experiments in LVBT Labs.',
      ],
      links: [
        {
          label: 'Open LVBT Labs',
          href: 'https://labs.lasvegasfortransit.org/',
        },
        {
          label: 'Source on GitHub',
          href: 'https://github.com/LasVegasForTransit/transit-mapper',
        },
      ],
    },
  },
  {
    id: 'hypertext',
    name: 'Hypertext Studio',
    brand: 'hypertext',
    list: 2,
    size: 'w6 h3 studio',
    facets: ['software', 'people'],
    hint: 'About the studio',
    line: 'LogDate, Docket, and Curfew',
    stack: productList.map((p) => p.image),
    weight: 75,
    body: { kind: 'products', products: productList },
    detail: {
      media: {
        kind: 'stack',
        images: productList.map((p) => ({
          ...p.image,
          alt: p.detail.media.alt,
        })),
      },
      body: [
        'Hypertext Studio is Willie’s design lab and small business. It builds software for humans.',
      ],
      list: productList.map((p) => ({
        title: p.name,
        text: `${p.copy}.`,
        opens: p.id,
      })),
      links: [
        { label: 'Visit hypertext.studio', href: 'https://hypertext.studio/' },
      ],
    },
  },
  {
    id: 'rtc',
    name: 'Reasonable Tech Company',
    head: 'Reasonable Tech Company · Project Lovelace',
    brand: 'lovelace',
    list: 3,
    // Fills the row it shared with Atlas; back to `w4 h3` when Atlas returns.
    size: 'w6 h3 full',
    facets: ['software', 'systems'],
    hint: 'Meet Ada',
    line: 'Project Lovelace',
    stack: [LOVELACE_MEMORY, LOVELACE_ADA, LOVELACE_HOME],
    weight: 70,
    body: {
      kind: 'shot',
      ...LOVELACE_ADA,
      alt: 'Ada, the Lovelace assistant, finishing a task and summarizing what she did',
    },
    detail: {
      media: {
        kind: 'image',
        ...LOVELACE_ADA,
        alt: 'Ada finishing a task in Lovelace',
        framed: true,
      },
      body: [
        'Willie’s startup. It’s building Project Lovelace, a next-generation intelligent computer made of cross-platform AI services, platforms, and tools. Its assistant, Ada, takes a task, does the work, and shows you everything she did.',
      ],
      list: [
        {
          title: 'Ada',
          text: 'The assistant at the center of Lovelace. She remembers you and asks before anything consequential.',
        },
        {
          title: 'On every device',
          text: 'Apps for iPhone, iPad, Mac, Apple Watch, Vision Pro, and Android.',
        },
      ],
      links: [
        { label: 'Visit uselovelace.com', href: 'https://uselovelace.com/' },
        {
          label: 'Reasonable Tech Company',
          href: 'https://reasonabletech.co/',
        },
      ],
    },
  },
  {
    id: 'atlas',
    name: 'Atlas',
    brand: 'atlas',
    size: 'w2 h3 atlas',
    facets: ['systems', 'people'],
    hint: 'Look closer',
    weight: 10,
    // Hidden until Atlas has something real to show.
    hidden: true,
    body: { kind: 'atlas', copy: 'Finding the helpers.' },
    detail: {
      media: { kind: 'constellation' },
      body: [
        'A directory for finding the helpers. It’s part of the Rebuilding America Project, and it isn’t ready to show yet.',
      ],
      links: [
        {
          label: 'The Rebuilding America Project',
          href: 'https://rebuildingus.org/',
        },
      ],
    },
  },
];

/** The ventures the homepage shows, leaving out any marked `hidden`. */
const shownVentures = ventures.filter((v) => !v.hidden);

/** Anything the rail, the tiles, or the detail view can point at. */
export interface Entry {
  id: string;
  name: string;
  brand: BrandKey;
  facets: Facet[];
  parent?: string;
  detail: Detail;
}

/** Ventures and products by id, for lookups from a `data-id` or `?detail=`. */
export const entries: Record<string, Entry> = Object.fromEntries(
  [...shownVentures, ...productList].map((e) => [e.id, e])
);

/** The rail previews only the top-level ventures, in their listed order. */
export const railVentures: Venture[] = shownVentures
  .filter((v) => v.list !== undefined)
  .sort((a, b) => (a.list ?? 0) - (b.list ?? 0));

interface TileEntryBase {
  id: string;
  kind: 'venture' | 'initiative';
  /** Higher weights sort first. Ventures use 10 to 100. */
  weight: number;
  size: string;
}

export interface VentureTile extends TileEntryBase {
  kind: 'venture';
  venture: Venture;
}

/**
 * A featured initiative surfaced on the homepage. The initiative system adds
 * these through `getHomeTiles(extra)`; the tile links to the initiative page
 * rather than opening a detail view.
 */
export interface InitiativeTile extends TileEntryBase {
  kind: 'initiative';
  name: string;
  head: string;
  hint: string;
  href: string;
  tagline: string;
  facets: Facet[];
  /** Material custom properties computed from the initiative's own seed. */
  brandVars?: Record<string, string>;
  image?: { src: string; alt: string };
  /** `playbill` renders the initiative's acts; `cover` shows its art. */
  body: 'cover' | 'playbill';
}

export type TileEntry = VentureTile | InitiativeTile;

const ventureTiles: VentureTile[] = shownVentures.map((venture) => ({
  id: venture.id,
  kind: 'venture',
  weight: venture.weight,
  size: venture.size,
  venture,
}));

/** The grid's tiles, heaviest first, with any extra entries merged in. */
export function getHomeTiles(extra: TileEntry[] = []): TileEntry[] {
  return [...ventureTiles, ...extra].sort((a, b) => b.weight - a.weight);
}
