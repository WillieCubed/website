import matter from 'gray-matter';
import { join } from 'node:path';

import { markdownFiles } from '@/lib/content/files';
import { existsSync, readFileSync } from '@/lib/content/runtime-files';
import { statusFromDates as projectStatus } from '@/lib/content/status';

import { type Project, ProjectFrontmatterSchema } from './schema';

/**
 * Read project content and validate relationships before filtering visibility.
 */

export const PROJECTS_DIR = join(process.cwd(), 'content', 'projects');

export { statusFromDates as projectStatus } from '@/lib/content/status';

function readProject(filePath: string, slug: string, now: Date): Project {
  const { data, content } = matter(readFileSync(filePath, 'utf8'));
  const parsed = ProjectFrontmatterSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Invalid project frontmatter in ${filePath}:\n${parsed.error.message}`
    );
  }
  const { status, ...rest } = parsed.data;
  const isPublic = rest.visibility === 'public';
  return {
    ...rest,
    slug,
    status: projectStatus(status, rest.starts, rest.ends, now),
    // A facts-only project never carries its body or its media past the
    // loader, so no page or feed can render either by accident.
    content: isPublic ? content.trim() : '',
    media: isPublic ? rest.media : [],
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
  const all = markdownFiles(dir, ['.mdx']).map((file) =>
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
