import matter from 'gray-matter';
import { cacheLife } from 'next/cache';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  type Initiative,
  InitiativeFrontmatterSchema,
  type InitiativeStatus,
  type Part,
  PartFrontmatterSchema,
} from './schema';

export * from './schema';

const CONTENT_DIR = join(process.cwd(), 'content', 'initiatives');
const HIDDEN_PREFIX = '_';

/** Turns a part number into its URL segment. */
export function partSlug(number: number): string {
  return `part-${number}`;
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
export function statusFromDates(
  explicit: InitiativeStatus | undefined,
  starts: Date | undefined,
  ends: Date | undefined,
  now: Date
): InitiativeStatus {
  if (explicit) return explicit;
  if (starts && now < starts) return 'planned';
  if (ends && now > endOfDay(ends)) return 'complete';
  if (starts) return 'active';
  return 'planned';
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function readFrontmatter(filePath: string) {
  const { data, content } = matter(readFileSync(filePath, 'utf8'));
  return { data, content };
}

function initiativeDir(slug: string): string {
  return join(CONTENT_DIR, slug);
}

function listInitiativeSlugs(): string[] {
  if (!existsSync(CONTENT_DIR)) return [];
  return readdirSync(CONTENT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => !entry.name.startsWith(HIDDEN_PREFIX))
    .filter((entry) => existsSync(join(CONTENT_DIR, entry.name, 'index.mdx')))
    .map((entry) => entry.name)
    .sort();
}

function loadParts(slug: string, now: Date): Part[] {
  const dir = join(initiativeDir(slug), 'parts');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => /\.mdx?$/.test(file) && !file.startsWith(HIDDEN_PREFIX))
    .map((file) => {
      const filePath = join(dir, file);
      const { data, content } = readFrontmatter(filePath);
      const parsed = PartFrontmatterSchema.safeParse(data);
      if (!parsed.success) {
        throw new Error(
          `Invalid part frontmatter in ${filePath}:\n${parsed.error.message}`
        );
      }
      const { status, ...rest } = parsed.data;
      return {
        ...rest,
        slug: partSlug(rest.number),
        initiative: slug,
        status: statusFromDates(status, rest.starts, rest.ends, now),
        content,
      } satisfies Part;
    })
    .filter((part) => !part.draft || process.env.NODE_ENV !== 'production')
    .sort((a, b) => a.number - b.number);
}

function loadInitiative(slug: string, now: Date): Initiative {
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
  const parts = loadParts(slug, now);
  const { status, ...rest } = parsed.data;
  const starts = rest.starts ?? parts[0]?.starts;
  const ends = rest.ends ?? parts.at(-1)?.ends;
  return {
    ...rest,
    starts,
    ends,
    slug,
    status: statusFromDates(status, starts, ends, now),
    content,
    parts,
    href: `/initiatives/${slug}`,
  };
}

/** Every initiative slug with an index.mdx, hidden ones excluded. */
export async function getInitiativeSlugs(): Promise<string[]> {
  'use cache';
  cacheLife('hours');
  return listInitiativeSlugs();
}

/** One initiative with its parts, statuses resolved against the clock. */
export async function getInitiative(slug: string): Promise<Initiative> {
  'use cache';
  cacheLife('hours');
  return loadInitiative(slug, new Date());
}

/**
 * All initiatives, drafts excluded in production, most recent start first.
 */
export async function getInitiatives(): Promise<Initiative[]> {
  'use cache';
  cacheLife('hours');
  const now = new Date();
  return listInitiativeSlugs()
    .map((slug) => loadInitiative(slug, now))
    .filter((item) => !item.draft || process.env.NODE_ENV !== 'production')
    .sort((a, b) => (b.starts?.getTime() ?? 0) - (a.starts?.getTime() ?? 0));
}

/** Initiatives that declare a homepage feature block. */
export async function getFeaturedInitiatives(): Promise<Initiative[]> {
  const all = await getInitiatives();
  return all
    .filter((item) => item.feature)
    .sort((a, b) => (b.feature?.weight ?? 0) - (a.feature?.weight ?? 0));
}

/** One part of an initiative, by its `part-N` slug. */
export async function getPart(
  initiativeSlug: string,
  slug: string
): Promise<{ initiative: Initiative; part: Part } | null> {
  const number = parsePartSlug(slug);
  if (number === null) return null;
  const initiative = await getInitiative(initiativeSlug);
  const part = initiative.parts.find((item) => item.number === number);
  return part ? { initiative, part } : null;
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

/** Children of an initiative (initiatives whose parent is this slug). */
export async function getChildInitiatives(slug: string): Promise<Initiative[]> {
  const all = await getInitiatives();
  return all.filter((item) => item.parent === slug);
}

/** Every initiative slug that has an `initiative` with that slug as parent. */
export async function initiativeExists(slug: string): Promise<boolean> {
  const slugs = await getInitiativeSlugs();
  return slugs.includes(slug);
}
