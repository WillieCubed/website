import { z } from 'zod';

/**
 * Frontmatter schemas for initiatives and their parts.
 *
 * Every initiative page and homepage tile reads these fields, and dates drive
 * countdowns, the Playbill's current act, sitemap timestamps, and social
 * images, so a typo has to fail the build rather than render as "Invalid
 * Date". See docs/initiatives.md for the authoring guide.
 */

/**
 * A calendar date with no time. YAML parses `2026-08-01` as UTC midnight,
 * which formats as July 31 anywhere west of Greenwich, so dates are
 * re-anchored to local midnight and every consumer treats them as days.
 */
export const DateSchema = z.preprocess((value) => {
  if (value instanceof Date) {
    return new Date(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate()
    );
  }
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }
  return value;
}, z.date());

export const StatusSchema = z.enum([
  'planned',
  'active',
  'paused',
  'complete',
  'archived',
]);
export type InitiativeStatus = z.infer<typeof StatusSchema>;

export const KindSchema = z.enum(['campaign', 'series', 'project']);
export type InitiativeKind = z.infer<typeof KindSchema>;

export const MediaSchema = z.object({
  src: z.string().min(1),
  alt: z.string().min(1),
  kind: z.enum(['image', 'video']).default('image'),
  /** Aspect ratio as width/height, used to reserve space before load. */
  aspect: z.number().positive().optional(),
});
export type Media = z.infer<typeof MediaSchema>;

export const PlaceSchema = z.object({
  name: z.string().min(1),
  region: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type Place = z.infer<typeof PlaceSchema>;

export const MilestoneSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  date: DateSchema,
  /** Set once the milestone happened. */
  done: z.boolean().default(false),
});
export type Milestone = z.infer<typeof MilestoneSchema>;

export const LinkSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});
export type InitiativeLink = z.infer<typeof LinkSchema>;

export const SyndicationSchema = z.object({
  platform: z.string().min(1),
  url: z.string().url(),
});

/** Grid spans the homepage tile grid understands (columns × rows). */
export const TileSizeSchema = z.enum([
  'w2 h2',
  'w2 h3',
  'w3 h2',
  'w3 h3',
  'w4 h3',
  'w6 h3',
]);
export type TileSize = z.infer<typeof TileSizeSchema>;

export const FacetSchema = z.enum(['software', 'systems', 'people']);
export type Facet = z.infer<typeof FacetSchema>;

/** How an initiative shows up on the homepage tile grid. */
export const FeatureSchema = z.object({
  /** 0–100; ventures sit at 100 (LVBT) down to 10 (Atlas). */
  weight: z.number().int().min(0).max(100),
  size: TileSizeSchema.default('w3 h3'),
  /** The one-line hint shown on hover, e.g. "Follow the tour". */
  hint: z.string().min(1),
  facets: z.array(FacetSchema).default([]),
  /** Include the initiative in the rail index at this position. */
  list: z.number().int().positive().optional(),
});
export type Feature = z.infer<typeof FeatureSchema>;

export const TrailerSchema = z.object({
  title: z.string().min(1),
  /** Missing until the video is published; the page shows a poster instead. */
  youtubeId: z.string().min(1).optional(),
  poster: MediaSchema.optional(),
});
export type Trailer = z.infer<typeof TrailerSchema>;

export const InitiativeFrontmatterSchema = z.object({
  title: z.string().min(1),
  tagline: z.string().min(1),
  description: z.string().min(1),
  kind: KindSchema,
  /** Slug of the initiative this belongs to, e.g. `twd` for Fall Tour. */
  parent: z.string().optional(),
  status: StatusSchema.optional(),
  starts: DateSchema.optional(),
  ends: DateSchema.optional(),
  /** The last day the page was meaningfully edited. Feeds the sitemap. */
  updated: DateSchema.optional(),
  /** A key in lib/brand/seeds.json or a `#rrggbb` hex. */
  brand: z
    .string()
    .regex(/^(#[0-9a-fA-F]{6}|[a-z][a-z0-9-]*)$/)
    .optional(),
  cover: MediaSchema.optional(),
  trailer: TrailerSchema.optional(),
  /** The word before an act number. "Part" renders as "Part 1". */
  partLabel: z.string().min(1).default('Part'),
  /**
   * The initiative's own website, when it has one. The page leads with a
   * link to it rather than repeating what lives there.
   */
  website: z
    .string()
    .url()
    .regex(/^https:\/\//)
    .optional(),
  links: z.array(LinkSchema).default([]),
  syndication: z.array(SyndicationSchema).default([]),
  feature: FeatureSchema.optional(),
  draft: z.boolean().default(false),
});
export type InitiativeFrontmatter = z.infer<typeof InitiativeFrontmatterSchema>;

export const PartFrontmatterSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1),
  tagline: z.string().optional(),
  description: z.string().optional(),
  starts: DateSchema,
  ends: DateSchema,
  /** The last day the page was meaningfully edited. Feeds the sitemap. */
  updated: DateSchema.optional(),
  status: StatusSchema.optional(),
  places: z.array(PlaceSchema).default([]),
  cover: MediaSchema.optional(),
  milestones: z.array(MilestoneSchema).default([]),
  draft: z.boolean().default(false),
});
export type PartFrontmatter = z.infer<typeof PartFrontmatterSchema>;

export interface Part extends Omit<PartFrontmatter, 'status'> {
  /** `part-1`, the URL segment. */
  slug: string;
  /** The parent initiative's slug. */
  initiative: string;
  /** Resolved from dates when the frontmatter does not set one. */
  status: InitiativeStatus;
  /** MDX body. */
  content: string;
}

export interface Initiative extends Omit<InitiativeFrontmatter, 'status'> {
  slug: string;
  status: InitiativeStatus;
  content: string;
  parts: Part[];
  /** Site-relative path of the initiative page. */
  href: string;
}
