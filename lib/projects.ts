import { join } from 'path';
import { readdirSync, readFileSync } from 'node:fs';
import { serialize } from 'next-mdx-remote/serialize';
import rehypeSlug from 'rehype-slug';
import { parseISO } from 'date-fns';
import { ProjectData } from './common';

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

const MDX_OPTIONS = {
  parseFrontmatter: true,
  mdxOptions: {
    rehypePlugins: [rehypeSlug],
  },
};

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

  const posthFilePath = join(projectsDirectory, `${codename}.mdx`);
  const source = readFileSync(posthFilePath);
  const mdxSource = await serialize(source, MDX_OPTIONS);
  const project: ProjectData = {
    ...(mdxSource.frontmatter as ProjectData),
    launched: mdxSource.frontmatter.launched as Date,
  };
  return { mdxSource, project };
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

export const FEATURED_LIST: string[] = ['hackportal', 'connie'];

export async function getFeaturedProjects(): Promise<ProjectData[]> {
  const projects = await getAllProjects();
  const featuredProjects = projects.filter((project) => {
    return FEATURED_LIST.includes(project.codename);
  });
  return projects;
}

export async function getFeaturedWork() {
  return {
    type: 'Client Work', // 'Research', 'Personal Projects', 'Client Work', 'Design', 'Other
    projectId: 'connie',
    title: 'Connie',
    tagline:
      'A real-time communications center that keeps nonprofits in touch with older American adults.',
    description: 'Built for the American Society on Aging',
    timePeriod: 'October 2023–now',
    website: 'https://github.com/ConnieML/Connie-RTC',
  };
}
