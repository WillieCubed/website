import { cacheLife } from 'next/cache';

import { showDrafts } from '@/lib/drafts';

import { loadAllProjects } from './load';
import type { Project } from './schema';

export * from './load';
export * from './owners';
export * from './schema';

/** Every visible project, drafts included only in development. */
export async function getProjects(): Promise<Project[]> {
  'use cache';
  cacheLife('hours');
  return loadAllProjects({ includeDrafts: showDrafts });
}

export async function getProject(slug: string): Promise<Project | null> {
  return (await getProjects()).find((project) => project.slug === slug) ?? null;
}

export async function getProjectSlugs(): Promise<string[]> {
  return (await getProjects()).map((project) => project.slug);
}
