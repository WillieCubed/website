import { getInitiatives } from '@/lib/initiatives';
import { searchContent } from '@/lib/search/server';
import { isHiatusMode } from '@/lib/site-mode';
import {
  getAllWritings,
  getPublishedWriting,
  getPublishedWritingSlugs,
} from '@/lib/writings';

import {
  type SiteContent,
  contentForMode,
  summarizeWriting,
} from './site-server';

/**
 * The site's own loaders behind the MCP tools. Each one already hides drafts
 * in production, which is the only visibility rule they rely on; hiatus mode
 * is applied on top by `contentForMode`.
 */
const liveContent: SiteContent = {
  async listWritings() {
    return (await getAllWritings()).map(summarizeWriting);
  },

  async readWriting(slug) {
    // Only a missing slug or a draft in production means "not found". Any
    // other failure is a real error and is left to surface as one.
    if (!(await getPublishedWritingSlugs()).includes(slug)) return null;
    const { writing, content } = await getPublishedWriting(slug);
    return { ...summarizeWriting(writing), markdown: content };
  },

  async searchWritings(query, limit) {
    const { results } = await searchContent(query, { limit });
    return results.map((result) => ({
      ...summarizeWriting(result),
      snippet: result.snippet,
    }));
  },

  async listInitiatives() {
    return (await getInitiatives()).map((initiative) => ({
      slug: initiative.slug,
      title: initiative.title,
      description: initiative.description,
      kind: initiative.kind,
      status: initiative.status,
    }));
  },
};

export const siteContent = contentForMode(isHiatusMode(), liveContent);
