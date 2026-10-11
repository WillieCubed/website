import { getInitiatives } from '@/lib/initiatives';
import { searchContent } from '@/lib/search/server';
import { getAllWritings, getPublishedWriting } from '@/lib/writings';

import { type SiteContent, summarizeWriting } from './site-server';

/**
 * The site's own loaders behind the MCP tools. Public discovery always excludes drafts, including in development and preview.
 */
export const siteContent: SiteContent = {
  async listWritings() {
    return (await getAllWritings(false)).map(summarizeWriting);
  },

  async readWriting(slug) {
    // Check public membership before loading a body, in every deployment mode.
    if (!(await getAllWritings(false)).some((writing) => writing.slug === slug))
      return null;
    const { writing, content } = await getPublishedWriting(slug);
    return { ...summarizeWriting(writing), markdown: content };
  },

  async searchWritings(query, limit) {
    // searchContent covers initiatives and pages as well now, and "all" means
    // all of them. This tool only promises writings, and every result it
    // returns is given a /writings/ URL, so it asks for writings by name.
    const { results } = await searchContent(query, { type: 'writing', limit });
    return results.map((result) => ({
      ...summarizeWriting(result),
      snippet: result.snippet,
    }));
  },

  async listInitiatives() {
    return (await getInitiatives())
      .filter((initiative) => !initiative.draft)
      .map((initiative) => ({
        slug: initiative.slug,
        title: initiative.title,
        description: initiative.description,
        kind: initiative.kind,
        status: initiative.status,
      }));
  },
};
