import matter from 'gray-matter';
import { join } from 'node:path';
import { cache } from 'react';

import { type BrandSeed, brandSeeds } from '@/lib/brand/scheme';
import { markdownFiles } from '@/lib/content/files';
import {
  existsSync,
  readFileSync,
  readdirSync,
} from '@/lib/content/runtime-files';
import { statusFromDates } from '@/lib/content/status';

import {
  type Initiative,
  InitiativeFrontmatterSchema,
  type Part,
  PartFrontmatterSchema,
} from './schema';

export * from './schema';

const HIDDEN_PREFIX = '_';
const CONTENT_DIR = join(process.cwd(), 'content', 'initiatives');
/** Slugs that conflict with static routes under /initiatives/. */
const RESERVED_SLUGS = ['opengraph-image'];

/** Turns a part number into its URL segment. */
export function partSlug(number: number): string {
  return `part-${number}`;
}

/**
 * A part's name as it reads away from its initiative: in a social card, a
 * search result, or a browser tab. "Part 1: A Boy Goes Back to Dallas" means
 * nothing on its own, so the initiative leads, the way Docket names it.
 */
export function partTitle(
  initiative: Pick<Initiative, 'title' | 'partLabel'>,
  part: Pick<Part, 'number' | 'title'>
): string {
  return `${initiative.title} ${initiative.partLabel} ${part.number}: ${part.title}`;
}

/** Parses `part-3` back into 3, or null for anything else. */
export function parsePartSlug(slug: string): number | null {
  const match = /^part-(\d+)$/.exec(slug);
  return match ? Number(match[1]) : null;
}

/**
 * Resolves a status from the dates when the author did not set one.
 * Planned before it starts, active while it runs, complete afterwards.
 */
export { statusFromDates } from '@/lib/content/status';

function readFrontmatter(filePath: string) {
  const { data, content } = matter(readFileSync(filePath, 'utf8'));
  return { data, content };
}

/**
 * Turns a `brand` seed key into its hex so every consumer (the page theme,
 * the browser chrome, social images, hover cards) only ever sees `#rrggbb`.
 * An unknown key fails the build rather than rendering unbranded.
 */
function resolveBrand(
  brand: string | undefined,
  filePath: string
): string | undefined {
  if (!brand || brand.startsWith('#')) return brand;
  const seed = (brandSeeds as Record<string, BrandSeed | undefined>)[brand];
  if (!seed) {
    throw new Error(
      `Unknown brand "${brand}" in ${filePath}; use a #rrggbb hex or a key in lib/brand/seeds.json.`
    );
  }
  return seed.hex;
}

function initiativeDir(slug: string): string {
  return join(CONTENT_DIR, slug);
}

export const listInitiativeSlugs = cache((): string[] => {
  if (!existsSync(CONTENT_DIR)) return [];
  return readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !entry.name.startsWith(HIDDEN_PREFIX))
    .filter((entry) => !RESERVED_SLUGS.includes(entry.name))
    .filter((entry) => existsSync(join(CONTENT_DIR, entry.name, 'index.mdx')))
    .map((entry) => entry.name)
    .sort();
});

function loadParts(slug: string, now: Date, includeDrafts = false): Part[] {
  const dir = join(initiativeDir(slug), 'parts');
  if (!existsSync(dir)) return [];
  const parts = markdownFiles(dir).map((file) => {
    const filePath = join(dir, file);
    const { data, content } = readFrontmatter(filePath);
    const parsed = PartFrontmatterSchema.safeParse(data);
    if (!parsed.success) {
      throw new Error(
        `Invalid part frontmatter in ${filePath}:\n${parsed.error.message}`
      );
    }
    const { status, ...rest } = parsed.data;
    if (rest.ends < rest.starts) {
      throw new Error(`Part ends before it starts in ${filePath}`);
    }
    return {
      ...rest,
      milestones: [...rest.milestones].sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      ),
      slug: partSlug(rest.number),
      initiative: slug,
      status: statusFromDates(status, rest.starts, rest.ends, now),
      content,
    } satisfies Part;
  });
  const numbers = new Set<number>();
  for (const part of parts) {
    if (numbers.has(part.number)) {
      throw new Error(`Two parts of "${slug}" are numbered ${part.number}`);
    }
    numbers.add(part.number);
  }
  return parts
    .filter((part) => !part.draft || includeDrafts)
    .sort((a, b) => a.number - b.number);
}

export function loadInitiative(
  slug: string,
  now: Date,
  includeDraftParts = false
): Initiative {
  const filePath = join(initiativeDir(slug), 'index.mdx');
  if (!existsSync(filePath)) {
    throw new Error(`Initiative "${slug}" cannot be found.`);
  }
  const { data, content } = readFrontmatter(filePath);
  const parsed = InitiativeFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Invalid initiative frontmatter in ${filePath}:\n${parsed.error.message}`
    );
  }
  const parts = loadParts(slug, now, includeDraftParts);
  const { status, ...rest } = parsed.data;
  if (rest.parent && !listInitiativeSlugs().includes(rest.parent)) {
    throw new Error(`Unknown parent "${rest.parent}" in ${filePath}`);
  }
  const starts = rest.starts ?? parts[0]?.starts;
  const ends = rest.ends ?? parts.at(-1)?.ends;
  return {
    ...rest,
    brand: resolveBrand(rest.brand, filePath),
    starts,
    ends,
    slug,
    status: statusFromDates(status, starts, ends, now),
    content,
    parts,
    href: `/initiatives/${slug}`,
  };
}

/**
 * Load initiatives and derive part statuses against the supplied clock.
 * Draft initiatives and parts are excluded unless `includeDrafts` is set.
 */
export function loadAllInitiatives(
  options: { includeDrafts?: boolean; now?: Date } = {}
): Initiative[] {
  const { includeDrafts = false, now = new Date() } = options;
  const slugs = listInitiativeSlugs();
  return slugs
    .map((slug) => loadInitiative(slug, now, includeDrafts))
    .filter((item) => includeDrafts || !item.draft);
}

/** The part currently running, else the next one up, else the last. */
export function currentPart(initiative: Initiative): Part | undefined {
  const { parts } = initiative;
  return (
    parts.find((part) => part.status === 'active') ??
    parts.find((part) => part.status === 'planned') ??
    parts.at(-1)
  );
}
