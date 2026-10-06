import matter from 'gray-matter';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

import { showDrafts } from './drafts';

const sourceUrl = z
  .string()
  .url()
  .regex(/^https?:\/\//);
const text = z.string().trim().min(1);
const frontmatterSchema = z.strictObject({
  title: text,
  publication: text,
  url: sourceUrl,
  // Quoted dates prevent YAML from silently rolling invalid days into another month.
  published: z.iso.date(),
  image: z
    .strictObject({
      src: text,
      alt: text,
      source: sourceUrl.optional(),
      credit: text.optional(),
      fit: z.enum(['cover', 'contain']).default('cover'),
    })
    .optional(),
  featured: z.boolean().default(false),
  excerpt: text.optional(),
  related: z
    .strictObject({
      label: text,
      href: z.union([sourceUrl, z.string().regex(/^\/(?!\/)/)]),
    })
    .optional(),
  draft: z.boolean().default(false),
});

export type MediaMention = z.infer<typeof frontmatterSchema> & { id: string };

export function getMediaMention(
  id: string,
  directory = join(process.cwd(), 'content', 'media')
): MediaMention {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error('Expected a media content filename without .md.');
  }
  const filePath = join(directory, `${id}.md`);
  const { data } = matter(readFileSync(filePath, 'utf8'));
  const parsed = frontmatterSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Invalid media frontmatter in ${filePath}:\n${parsed.error.message}`
    );
  }
  return {
    ...parsed.data,
    id,
    featured: parsed.data.featured && Boolean(parsed.data.image),
  };
}

export function getMediaMentions({
  directory = join(process.cwd(), 'content', 'media'),
  includeDrafts = showDrafts,
}: { directory?: string; includeDrafts?: boolean } = {}): MediaMention[] {
  return readdirSync(directory)
    .filter((file) => file.endsWith('.md') && !file.startsWith('_'))
    .map((file) => getMediaMention(file.slice(0, -3), directory))
    .filter((mention) => !mention.draft || includeDrafts)
    .sort(
      (a, b) =>
        b.published.localeCompare(a.published) || a.id.localeCompare(b.id)
    );
}
