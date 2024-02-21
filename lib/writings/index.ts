import { serialize } from 'next-mdx-remote/serialize';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import rehypeSlug from 'rehype-slug';
import { fetchConfig } from '../config';

const HIDDEN_ITEM_PREFIX = '_';

const writingsDirectory = join(process.cwd(), 'content/writings');

const MDX_OPTIONS = {
  parseFrontmatter: true,
  mdxOptions: {
    rehypePlugins: [rehypeSlug],
  },
};

export type WritingData = {
  slug: string;
  title: string;
  description: string;
  published: Date;
  lastUpdated: Date;
};

/**
 * Fetches the slugs of all writings.
 *
 * All writings must be markdown files. This excludes any files that are hidden
 * (i.e. start with an underscore {@see HIDDEN_ITEM_PREFIX }).
 *
 * @returns The codenames of all non-hidden projects
 */
export async function getWritingSlugs(): Promise<string[]> {
  const slugs = readdirSync(writingsDirectory)
    .filter((file) => file.endsWith('.mdx') || file.endsWith('.md')) // Only include markdown files
    .filter((file) => !file.startsWith(HIDDEN_ITEM_PREFIX)) // Remove special files, including template files
    .map((file) => file.replace(/\.mdx?$/, '')); // Remove the file extension
  return slugs;
}

/**
 * Fetches the data for a writing.
 *
 * @param slug The UID of the writing.
 *
 * @returns The corresponding writing data.
 */
export async function getWriting(slug: string) {
  const slugIndex = (await getWritingSlugs()).findIndex(
    (project) => project === slug
  );
  if (slugIndex == -1) {
    throw new Error(`Writing with given codename "${slug}" cannot be found.`);
  }
  const writingPath = join(writingsDirectory, `${slug}.mdx`);
  let source;
  try {
    source = readFileSync(writingPath);
  } catch (e) {
    try {
      const writingPath = join(writingsDirectory, `${slug}.md`);
      source = readFileSync(writingPath);
    } catch (e) {
      throw new Error(`Writing with given codename "${slug}" cannot be found.`);
    }
  }
  const mdxSource = await serialize(source, MDX_OPTIONS);
  const writing: WritingData = {
    ...(mdxSource.frontmatter as WritingData),
    slug: slug,
    published: mdxSource.frontmatter.published as Date,
    lastUpdated: mdxSource.frontmatter.lastUpdated as Date,
  };
  return { mdxSource, writing };
}

/**
 * @returns All writings
 */
export async function getAllWritings() {
  const slugs = await getWritingSlugs();
  const writings = await Promise.all(
    slugs.map(async (slug) => {
      const { writing } = await getWriting(slug);
      return writing;
    })
  );
  return writings;
}

export async function getFeaturedWritings(): Promise<WritingData[]> {
  const featuredListConfig = await fetchConfig('featured_writings');
  if (!featuredListConfig) {
    return [];
  }
  const projects = await getAllWritings();
  const featuredProjects = projects.filter((writing) => {
    return (featuredListConfig as string[]).includes(writing.slug);
  });
  return featuredProjects;
}
