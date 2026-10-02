import matter from 'gray-matter';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  type Project,
  ProjectFrontmatterSchema,
  type ProjectStatus,
} from './schema';

/**
 * Reads content/projects with no Next.js cache involved, so tests and
 * build scripts can call it under plain Node. Pages use lib/projects.
 */

export const PROJECTS_DIR = join(process.cwd(), 'content', 'projects');
const HIDDEN_PREFIX = '_';

export function projectStatus(
  explicit: ProjectStatus | undefined,
  starts: Date | undefined,
  ends: Date | undefined,
  now: Date
): ProjectStatus {
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

function readProject(filePath: string, slug: string, now: Date): Project {
  const { data, content } = matter(readFileSync(filePath, 'utf8'));
  const parsed = ProjectFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Invalid project frontmatter in ${filePath}:\n${parsed.error.message}`
    );
  }
  const { status, ...rest } = parsed.data;
  return {
    ...rest,
    slug,
    status: projectStatus(status, rest.starts, rest.ends, now),
    // A facts-only project never carries its body past the loader, so no
    // page or feed can render it by accident.
    content: rest.visibility === 'public' ? content.trim() : '',
    href: `/projects/${slug}`,
  };
}

const time = (date?: Date) => (date ? date.getTime() : Number.MIN_SAFE_INTEGER);

/** Pinned work first, then the most recent start, undated last, then by title. */
export function sortProjects(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) =>
      b.weight - a.weight ||
      time(b.starts) - time(a.starts) ||
      a.title.localeCompare(b.title)
  );
}

export function childrenOf(projects: Project[], slug: string): Project[] {
  return projects.filter((project) => project.parent === slug);
}

export interface LoadOptions {
  dir?: string;
  includeDrafts?: boolean;
  now?: Date;
}

export function loadAllProjects({
  dir = PROJECTS_DIR,
  includeDrafts = false,
  now = new Date(),
}: LoadOptions = {}): Project[] {
  if (!existsSync(dir)) return [];
  const all = readdirSync(dir)
    .filter((file) => file.endsWith('.mdx') && !file.startsWith(HIDDEN_PREFIX))
    .map((file) =>
      readProject(join(dir, file), file.replace(/\.mdx$/, ''), now)
    );
  // References are checked against every file, hidden and draft included,
  // so hiding a parent never breaks the build of its children.
  const slugs = new Set(all.map((project) => project.slug));
  for (const project of all) {
    if (
      project.parent &&
      (project.parent === project.slug || !slugs.has(project.parent))
    ) {
      throw new Error(
        `Project "${project.slug}" names a parent "${project.parent}" that does not exist.`
      );
    }
    if (
      project.successor &&
      !project.successor.startsWith('https://') &&
      !slugs.has(project.successor)
    ) {
      throw new Error(
        `Project "${project.slug}" names a successor "${project.successor}" that does not exist.`
      );
    }
  }
  return sortProjects(
    all.filter(
      (project) =>
        project.visibility !== 'hidden' && (includeDrafts || !project.draft)
    )
  );
}
