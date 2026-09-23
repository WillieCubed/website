import type { MetadataRoute } from 'next';

import { MCP_ENDPOINT } from '@/lib/mcp/constants';
import { absoluteUrl } from '@/lib/site';

/**
 * Generates a robots.txt file for the website.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Everyone not named below, including the agents llms.txt speaks to:
      // assistants fetching a page for a reader (ChatGPT-User, Claude-User,
      // Perplexity-User) and AI search (OAI-SearchBot, Claude-SearchBot,
      // PerplexityBot) are deliberately left out of the training group.
      {
        userAgent: ['*'],
        // llms.txt advertises the MCP server, which lives under /api/. The
        // longer Allow wins over the Disallow (RFC 9309).
        allow: ['/', MCP_ENDPOINT],
        disallow: ['/api/'],
      },
      // AI training crawlers stay off the whole site, which covers the
      // writings and the search artifacts that carry their full text. Search
      // crawlers and link-preview bots (Slackbot, LinkedInBot,
      // facebookexternalhit, Twitterbot) are not listed, so results and
      // unfurls work. Google-Extended and Applebot-Extended opt out of
      // training only; Googlebot and Applebot still index the site.
      {
        userAgent: [
          'GPTBot',
          'ClaudeBot',
          'anthropic-ai',
          'Google-Extended',
          'Applebot-Extended',
          'meta-externalagent',
          'FacebookBot',
          'CCBot',
          'Bytespider',
          'cohere-training-data-crawler',
          'AI2Bot',
          'Omgilibot',
        ],
        disallow: ['/'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
