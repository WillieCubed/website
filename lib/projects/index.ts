import { showDrafts } from '@/lib/content/visibility';

import { loadAllProjects } from './load';
import type { Project } from './schema';

export * from './load';
export * from './owners';
export * from './schema';

/** Every visible project, drafts included only in development. */
export async function getProjects(): Promise<Project[]> {
  return loadAllProjects({ includeDrafts: showDrafts });
}

/** Public discovery never includes drafts, including on a development server. */
export async function getPublishedProjects(): Promise<Project[]> {
  return loadAllProjects({ includeDrafts: false });
}

export async function getProject(slug: string): Promise<Project | null> {
  return (await getProjects()).find((project) => project.slug === slug) ?? null;
}
