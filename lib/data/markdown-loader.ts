// utils/markdown.ts
import { readFileSync, readdirSync } from 'fs';
import { serialize } from 'next-mdx-remote/serialize';
import { join } from 'path';
import rehypeSlug from 'rehype-slug';

export const CONTENT_DIRECTORY = join(process.cwd(), 'content');

const HIDDEN_ITEM_PREFIX = '_';

type FilterCallback = (file: string) => boolean;

/**
 * Fetches the slugs of all files in the given directory.
 *
 * By default, all files must be markdown files, and this excludes any files that are hidden
 * (i.e. start with an underscore {@see HIDDEN_ITEM_PREFIX }).
 *
 * @param directory The directory to search for files.
 * @param filter A callback to filter the files. Any file that returns `true` will be included.
 *
 * @returns The slugs of all files in the directory.
 */
export async function getFileSlugs(
  directory: string,
  filter: FilterCallback = DEFAULT_FILTER
): Promise<string[]> {
  const slugs = readdirSync(directory)
    .filter(filter)
    .map((file) => file.replace(/\.mdx?$/, '')); // Remove the file extension
  return slugs;
}

/**
 * A default filter that only includes markdown files, removes special and template files.
 */
const DEFAULT_FILTER = (file: string) => {
  return (
    file.endsWith('.mdx') ||
    (file.endsWith('.md') && // Only include markdown files
      !file.startsWith(HIDDEN_ITEM_PREFIX))
  ); // Remove special files, including template files
};

const MDX_OPTIONS = {
  parseFrontmatter: true,
  mdxOptions: {
    rehypePlugins: [rehypeSlug],
  },
};

/**
 * Fetches the data for a writing.
 *
 * This assumes that the slug is valud. If content with the given slug does not exist, this will
 * throw an error.
 *
 * @param slug The UID of the writing.
 *
 * @returns The corresponding writing data.
 */
export async function getContentData<T>(directory: string, slug: string) {
  const writingPath = join(directory, `${slug}.mdx`);
  let source;
  try {
    source = readFileSync(writingPath);
  } catch (e) {
    try {
      const writingPath = join(directory, `${slug}.md`);
      source = readFileSync(writingPath);
    } catch (e) {
      throw new Error(`Writing with given codename "${slug}" cannot be found.`);
    }
  }
  const mdxSource = await serialize(source, MDX_OPTIONS);
  const content: T = {
    ...(mdxSource.frontmatter as T),
    slug: slug,
    published: mdxSource.frontmatter.published as Date,
    lastUpdated: mdxSource.frontmatter.lastUpdated as Date,
  };
  return { mdxSource, writing: content };
}

export type ContentWrapper<T> = {
  mdxSource: any;
  writing: T;
  slug: string;
  published: Date;
  lastUpdated: Date;
};
