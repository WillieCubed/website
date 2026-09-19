import { getInitiatives } from '@/lib/initiatives';
import { searchContent } from '@/lib/search/server';
import { getAllWritings, getPublishedWriting } from '@/lib/writings';

import { type SiteContent, summarizeWriting } from './site-server';

/**
 * The site's own loaders behind the MCP tools. Each one already hides drafts
 * in production, which is the only visibility rule the tools rely on.
 */
export const siteContent: SiteContent = {
  async listWritings() {
    return (await getAllWritings()).map(summarizeWriting);
  },

  async readWriting(slug) {
    let loaded;
    try {
      loaded = await getPublishedWriting(slug);
    } catch {
      // A missing slug and a draft in production both throw.
      return null;
    }
    return { ...summarizeWriting(loaded.writing), markdown: loaded.content };
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
