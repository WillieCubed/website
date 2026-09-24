import matter from 'gray-matter';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'path';

import { ProjectData } from './common';
import { site } from './site';

const projectsDirectory = join(process.cwd(), 'content/projects');

const HIDDEN_ITEM_PREFIX = '_';

/**
 * Fetches the slugs (codenames) of all projects.
 *
 * All projects must be extended markdown (.mdx) files. This excludes any
 * projects or files that are hidden (i.e. start with an underscore
 * {@see HIDDEN_ITEM_PREFIX }).
 *
 * @returns The codenames of all non-hidden projects
 */
export async function getProjectSlugs(): Promise<string[]> {
  const slugs = readdirSync(projectsDirectory)
    .filter((file) => file.endsWith('.mdx')) // Only include MDX files
    .filter((file) => !file.startsWith(HIDDEN_ITEM_PREFIX)) // Remove special files, including template files
    .map((file) => file.replace(/\.mdx$/, '')); // Remove the .mdx file extension
  return slugs;
}

/**
 * Fetches the data for a project.
 *
 * @param codename The UID of the project.
 *
 * @returns The corresponding project data.
 */
export async function getProject(codename: string) {
  const slugIndex = (await getProjectSlugs()).findIndex(
    (project) => project === codename
  );
  if (slugIndex == -1) {
    throw new Error(
      `Project with given codename "${codename}" cannot be found.`
    );
  }

  const projectPath = join(projectsDirectory, `${codename}.mdx`);
  const { data, content } = matter(readFileSync(projectPath, 'utf8'));
  const fields = data as ProjectData;
  const project: ProjectData = {
    ...fields,
    // A project names its own contact only when it is someone else; the
    // address otherwise follows the site's (lib/site.ts).
    contact: {
      ...fields.contact,
      email: fields.contact?.email || site.emails.projects,
    },
    launched: new Date(data.launched as string),
  };
  return { content, project };
}

/**
 *
 * @returns All projects
 */
export async function getAllProjects() {
  const slugs = await getProjectSlugs();
  const projects = await Promise.all(
    slugs.map(async (slug) => {
      const { project } = await getProject(slug);
      return project;
    })
  );
  return projects;
}

// TODO: Extract to content file
export const FEATURED_LIST: string[] = [
  'hackportal',
  'connie',
  'nebula-planner',
];

export async function getFeaturedProjects(): Promise<ProjectData[]> {
  const projects = await getAllProjects();
  const featuredProjects = projects.filter((project) => {
    return FEATURED_LIST.includes(project.codename);
  });
  return featuredProjects;
}
