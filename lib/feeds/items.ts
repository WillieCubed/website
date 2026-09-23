import { getInitiatives } from '@/lib/initiatives';
import { getAllWritings, getWriting } from '@/lib/writings';

import { renderFeedHtml } from './html';
import {
  type FeedItem,
  initiativeToFeedItem,
  writingToFeedItem,
} from './index';

function newestFirst(items: FeedItem[]): FeedItem[] {
  return items.sort((a, b) => b.published.getTime() - a.published.getTime());
}

/** Every published writing with its full body, newest first. */
export async function getWritingFeedItems(): Promise<FeedItem[]> {
  const writings = await getAllWritings();
  const items = await Promise.all(
    writings.map(async (writing) => {
      const { content } = await getWriting(writing.slug);
      return writingToFeedItem(writing, await renderFeedHtml(content));
    })
  );
  return newestFirst(items);
}

/** Every published, dated initiative with its full body, newest first. */
export async function getInitiativeFeedItems(): Promise<FeedItem[]> {
  const initiatives = await getInitiatives();
  const items = await Promise.all(
    initiatives.map(async (initiative) =>
      initiativeToFeedItem(initiative, await renderFeedHtml(initiative.content))
    )
  );
  return newestFirst(items.filter((item) => item !== null));
}

/** What the site feeds carry: writings and initiatives, newest first. */
export async function getSiteFeedItems(): Promise<FeedItem[]> {
  const [writings, initiatives] = await Promise.all([
    getWritingFeedItems(),
    getInitiativeFeedItems(),
  ]);
  return newestFirst([...writings, ...initiatives]);
}
