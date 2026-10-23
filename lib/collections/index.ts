import matter from 'gray-matter';
import { join } from 'node:path';

import { markdownFiles, readMarkdownFile } from '@/lib/content/files';

import { findPublishedInitiative } from '../initiatives/index';
import { getWritingsInSeries } from '../writings/index';
import type { WritingData } from '../writings/types';

export interface SeriesDefinition {
  slug: string;
  name: string;
  description: string;
  coverImage?: string;
  startedAt?: string;
  complete?: boolean;
  content: string;
  /** Initiatives own their page even when a matching series file exists. */
  href: string;
}

export interface SeriesWithWritings extends SeriesDefinition {
  writings: WritingData[];
  totalParts: number;
}

const seriesDirectory = join(process.cwd(), 'content/series');

export async function getSeries(slug: string): Promise<SeriesDefinition> {
  const initiative = await findPublishedInitiative(slug);
  const hasFile = markdownFiles(seriesDirectory, ['.md', '.mdx'], true).some(
    (file) => file.replace(/\.mdx?$/, '') === slug
  );
  if (!hasFile && initiative) {
    return {
      slug,
      name: initiative.title,
      description: initiative.description,
      coverImage: initiative.cover?.src,
      startedAt: initiative.starts?.toISOString(),
      complete: initiative.status === 'complete',
      content: initiative.content,
      href: initiative.href,
    };
  }

  const { source } = readMarkdownFile(
    seriesDirectory,
    slug,
    `Collection "${slug}" of type "series" cannot be found.`,
    'exists'
  );
  const { data, content } = matter(source);
  const fields = data as Partial<SeriesDefinition>;
  return {
    slug,
    name: fields.name || slug,
    description: fields.description || '',
    coverImage: fields.coverImage,
    startedAt: fields.startedAt,
    complete: fields.complete ?? false,
    content,
    href: initiative ? initiative.href : `/writings?series=${slug}`,
  };
}

export async function getSeriesWithWritings(
  slug: string
): Promise<SeriesWithWritings> {
  const definition = await getSeries(slug);
  const writings = await getWritingsInSeries(slug);
  return { ...definition, writings, totalParts: writings.length };
}
