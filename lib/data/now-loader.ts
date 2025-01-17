import matter from 'gray-matter';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'path';

import {
  CONTENT_DIRECTORY,
  getContentData,
  getFileSlugs,
} from './markdown-loader';

const NOW_DIRECTORY = join(CONTENT_DIRECTORY, 'now');

/**
 * Fetches the data for a single Now entry.
 *
 * @param slug The UID of the entry
 *
 * @returns The corresponding Now entry
 */
async function getNowEntry(slug: string): Promise<NowItemData> {
  const data = getContentData<NowItemData>(NOW_DIRECTORY, slug);
  return data;
}

/**
 * @returns All writings
 */
export async function getAllNowEntries(): Promise<NowItemData[]> {
  const slugs = await getFileSlugs(NOW_DIRECTORY);
  const writings = await Promise.all(
    slugs.map(async (slug) => {
      const { writing } = await getNowEntry(slug);
      return writing;
    })
  );
  return writings;
}

export type NowItemData = {
  /**
   * A timestamp of when this Now entry happened.
   */
  date: Date;
  /**
   * A raw HTML string with the content of this entry.
   */
  content: string;
};
