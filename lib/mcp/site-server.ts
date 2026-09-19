import type { McpServer } from '@modelcontextprotocol/server';
import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';

import { absoluteUrl, site } from '@/lib/site';

export interface WritingSummary {
  slug: string;
  title: string;
  description: string;
  /** ISO date string. */
  published: string;
  tags: string[];
}

export interface WritingDocument extends WritingSummary {
  markdown: string;
}

export interface InitiativeSummary {
  slug: string;
  title: string;
  description: string;
  kind: string;
  status: string;
}

/**
 * What the server may say about the site. Every method returns published
 * content only, so a draft can never reach a client. The route wires this to
 * the site's loaders; tests pass plain data.
 */
export interface SiteContent {
  listWritings(): Promise<WritingSummary[]>;
  readWriting(slug: string): Promise<WritingDocument | null>;
  searchWritings(
    query: string,
    limit: number
  ): Promise<Array<WritingSummary & { snippet?: string }>>;
  listInitiatives(): Promise<InitiativeSummary[]>;
}

const DEFAULT_SEARCH_LIMIT = 10;

/**
 * In hiatus mode proxy.ts 404s /writings, so the tools must not serve
 * writings either. Initiatives stay: their pages are not blocked.
 */
export function contentForMode(
  hiatus: boolean,
  content: SiteContent
): SiteContent {
  if (!hiatus) return content;
  return {
    ...content,
    listWritings: async () => [],
    readWriting: async () => null,
    searchWritings: async () => [],
  };
}

/**
 * A writing reduced to what a client needs. `published` is a Date on a
 * WritingData and an ISO string on a SearchResult.
 */
export function summarizeWriting(writing: {
  slug: string;
  title: string;
  description: string;
  published: Date | string;
  tags: string[];
}): WritingSummary {
  return {
    slug: writing.slug,
    title: writing.title,
    description: writing.description,
    published: new Date(writing.published).toISOString(),
    tags: writing.tags,
  };
}

function reply(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function replyJson(value: unknown) {
  return reply(JSON.stringify(value, null, 2));
}

function fail(text: string) {
  return { isError: true, content: [{ type: 'text' as const, text }] };
}

function writingUrl(slug: string): string {
  return absoluteUrl(`/writings/${slug}`);
}

/** Registers the site's read-only tools. Nothing here writes anything. */
export function registerSiteTools(
  server: McpServer,
  content: SiteContent
): void {
  server.registerTool(
    'get_profile',
    {
      title: 'Get profile',
      description:
        'Who Willie Chalmers III is, where the site lives, his public profiles, and where the feeds are.',
    },
    async () =>
      replyJson({
        name: site.name,
        description: site.description,
        url: site.origin,
        handle: `@${site.author.handle}@${new URL(site.origin).hostname}`,
        social: site.social.map(({ label, href }) => ({ label, url: href })),
        feeds: {
          rss: absoluteUrl('/feed.xml'),
          atom: absoluteUrl('/feed/atom'),
          json: absoluteUrl('/feed/json'),
        },
        llms: absoluteUrl('/llms.txt'),
      })
  );

  server.registerTool(
    'list_writings',
    {
      title: 'List writings',
      description:
        'Every published writing, newest first, with its title, description, date, tags, and URL.',
    },
    async () =>
      replyJson(
        (await content.listWritings()).map((writing) => ({
          ...writing,
          url: writingUrl(writing.slug),
        }))
      )
  );

  server.registerTool(
    'get_writing',
    {
      title: 'Get a writing',
      description:
        'The full text of one published writing as MDX source (markdown with a few JSX components such as <Ref> and <SpotifyEmbed>), with its URL, date, and tags. Get the slug from list_writings or search_writings.',
      inputSchema: z.object({
        slug: z.string().min(1).describe('The writing slug, e.g. "my-post".'),
      }),
    },
    async ({ slug }) => {
      const writing = await content.readWriting(slug);
      if (!writing) return fail(`No published writing "${slug}".`);
      return reply(
        [
          `# ${writing.title}`,
          '',
          `URL: ${writingUrl(writing.slug)}`,
          `Published: ${writing.published}`,
          `Tags: ${writing.tags.join(', ')}`,
          '',
          writing.markdown,
        ].join('\n')
      );
    }
  );

  server.registerTool(
    'search_writings',
    {
      title: 'Search writings',
      description:
        'Search the published writings by keyword. Returns matches with a snippet around the first hit, best match first.',
      inputSchema: z.object({
        query: z.string().min(1).describe('Words to look for.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(DEFAULT_SEARCH_LIMIT)
          .describe('How many results to return, 1 to 20.'),
      }),
    },
    async ({ query, limit }) =>
      replyJson(
        (await content.searchWritings(query, limit)).map((writing) => ({
          ...writing,
          url: writingUrl(writing.slug),
        }))
      )
  );

  server.registerTool(
    'list_initiatives',
    {
      title: 'List initiatives',
      description:
        'Every published initiative (campaigns, series, and projects) with its kind, status, description, and URL.',
    },
    async () =>
      replyJson(
        (await content.listInitiatives()).map((initiative) => ({
          ...initiative,
          url: absoluteUrl(`/initiatives/${initiative.slug}`),
        }))
      )
  );

  server.registerTool(
    'brew_coffee',
    {
      title: 'Brew coffee',
      description:
        'Ask the server to brew coffee (HTCPCP, RFC 2324). It is a teapot, so it will refuse.',
    },
    async () =>
      fail(
        "418 I'm a teapot. This server is a teapot, not a coffee pot, so it cannot brew coffee (RFC 2324, section 2.3.2)."
      )
  );
}

/**
 * The MCP request handler for a route: a Web-standard function from
 * `Request` to `Response`, stateless, with no authentication because it
 * serves only what the site already publishes.
 */
export function createSiteMcpHandler(
  content: SiteContent
): (request: Request) => Promise<Response> {
  return createMcpHandler((server) => registerSiteTools(server, content), {
    serverInfo: { name: new URL(site.origin).hostname, version: '1.0.0' },
  });
}
