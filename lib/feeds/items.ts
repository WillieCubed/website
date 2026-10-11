import { cacheLife } from 'next/cache';

import { fetchPublicDocument } from '@/lib/indieweb/public-fetch';
import { getInitiatives } from '@/lib/initiatives';
import { getPublishedProjects } from '@/lib/projects';
import { absoluteUrl } from '@/lib/site';
import {
  type WritingData,
  getAllWritings,
  getWriting,
  getWritingsByTag,
} from '@/lib/writings';
import { plainTextHtml } from '@/lib/writings/content';
import { writingMediaHtml } from '@/lib/writings/media';

import { renderFeedHtml } from './html';
import {
  type FeedItem,
  initiativeToFeedItem,
  projectToFeedItem,
  writingToFeedItem,
} from './index';

function newestFirst(items: FeedItem[]): FeedItem[] {
  return items.sort((a, b) => b.published.getTime() - a.published.getTime());
}

/**
 * A writing's body as the plain HTML its feed items carry. The writings
 * index reuses it for a note's hidden e-content, and the cache renders each
 * body once for the index, the tag pages, and every feed.
 */
export async function getWritingContentHtml(slug: string): Promise<string> {
  'use cache';
  cacheLife('hours');
  const { content, writing } = await getWriting(slug);
  const url = absoluteUrl(`/writings/${slug}`);
  if (writing.contentFormat === 'html')
    return writingMediaHtml(writing, url, `<div dir="auto">${content}</div>`);
  const body =
    writing.contentFormat === 'text'
      ? plainTextHtml(content)
      : await renderFeedHtml(content);
  return body + writingMediaHtml(writing, url);
}

async function writingFeedItems(writings: WritingData[]) {
  const items = await Promise.all(
    writings.map(async (writing) => {
      const item = writingToFeedItem(
        writing,
        await getWritingContentHtml(writing.slug)
      );
      for (const attachment of item.attachments ?? []) {
        const response = await fetchPublicDocument(attachment.url, {
          method: 'HEAD',
          timeoutMs: 3000,
        }).catch(() => null);
        if (!response || response.status < 200 || response.status >= 300)
          continue;
        const length = response.headers?.get('content-length');
        if (
          length &&
          /^\d+$/.test(length) &&
          Number.isSafeInteger(Number(length))
        )
          attachment.size_in_bytes = Number(length);
        const type = response.headers
          ?.get('content-type')
          ?.split(';')[0]
          .trim();
        if (
          type &&
          /^(?:image|audio|video)\/[a-z0-9.+-]+$|^application\/pdf$/i.test(type)
        )
          attachment.mime_type = type;
      }
      return item;
    })
  );
  return newestFirst(items);
}

/** Every published writing with its full body, newest first. */
export async function getWritingFeedItems(): Promise<FeedItem[]> {
  return writingFeedItems(await getAllWritings());
}

/** Every published writing carrying the tag, with its full body. */
export async function getTagFeedItems(tag: string): Promise<FeedItem[]> {
  return writingFeedItems(await getWritingsByTag(tag));
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

/** Every published project with a real date and only its public body. */
export async function getProjectFeedItems(): Promise<FeedItem[]> {
  const projects = await getPublishedProjects();
  const items = await Promise.all(
    projects.map(async (project) =>
      projectToFeedItem(
        project,
        project.content ? await renderFeedHtml(project.content) : undefined
      )
    )
  );
  return newestFirst(items.filter((item) => item !== null));
}

/** What the site feeds carry: published writings, initiatives, and projects. */
export async function getSiteFeedItems(): Promise<FeedItem[]> {
  const [writings, initiatives, projects] = await Promise.all([
    getWritingFeedItems(),
    getInitiativeFeedItems(),
    getProjectFeedItems(),
  ]);
  return newestFirst([...writings, ...initiatives, ...projects]);
}
