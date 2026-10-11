import matter from 'gray-matter';

import { loadAllInitiatives } from '@/lib/initiatives';
import { collectSearchDocuments } from '@/lib/search/collect';
import { rankItems, tokenize } from '@/lib/search/rank';
import type {
  SearchOptions,
  SearchResponse,
  SearchableItem,
} from '@/lib/search/types';
import { getAllWritings, readWritingFile } from '@/lib/writings';

import { documentSource } from './document';
import { getStudioStore } from './store';

/** Request-time overlay only; never written into public JSON or Pagefind. */
export async function searchPrivate(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResponse> {
  if (!query.trim() || !tokenize(query).length)
    return { query, total: 0, results: [], backend: 'private' };
  const items = new Map(
    (await collectSearchDocuments()).map((item) => [item.path, item])
  );
  for (const writing of await getAllWritings(true)) {
    const path = `/writings/${writing.slug}`;
    items.set(path, {
      slug: writing.slug,
      path,
      title: writing.title,
      description: writing.description,
      content: matter(readWritingFile(writing.slug).source).content,
      tags: writing.tags,
      published: writing.published.toISOString(),
      type: 'writing',
    });
  }
  for (const initiative of loadAllInitiatives({ includeDrafts: true })) {
    for (const entry of [initiative, ...initiative.parts]) {
      const path =
        'href' in entry ? entry.href : `${initiative.href}/${entry.slug}`;
      items.set(path, {
        slug: path,
        path,
        title: entry.title,
        description: entry.description ?? '',
        content: entry.content,
        tags: [initiative.title],
        published: (entry.starts ?? new Date(0)).toISOString(),
        type: 'initiative',
      });
    }
  }
  for (const draft of await getStudioStore().list()) {
    const body = draft.head.body;
    const path = `/writings/${draft.slug}`;
    const item: SearchableItem = {
      slug: draft.slug,
      path,
      title: body.title || 'Untitled note',
      description: body.description,
      content: documentSource(body.document),
      tags: body.tags,
      published: draft.head.createdAt,
      type: 'writing',
    };
    items.set(path, item);
  }
  const filtered = [...items.values()].filter(
    (item) =>
      !options.type || options.type === 'all' || item.type === options.type
  );
  const matches = rankItems(filtered, query);
  const offset = options.offset ?? 0;
  return {
    query,
    total: matches.length,
    results: matches.slice(offset, offset + (options.limit ?? 20)),
    backend: 'private',
  };
}
