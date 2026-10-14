import type { MetadataRoute } from 'next';

import { MCP_ENDPOINT } from '@/lib/mcp/constants';
import { absoluteUrl } from '@/lib/site/urls';
import { isPrivatePreview } from '@/lib/studio/config';

/**
 * Return crawler rules that allow public indexing and MCP access while
 * blocking other API paths and AI training crawlers.
 */
export default function robots(): MetadataRoute.Robots {
  if (isPrivatePreview()) return { rules: { userAgent: '*', disallow: '/' } };

  return {
    rules: [
      // Everyone not named below, including agents reading the site summary:
      // assistants fetching a page for a reader (ChatGPT-User, Claude-User,
      // Perplexity-User) and AI search (OAI-SearchBot, Claude-SearchBot,
      // PerplexityBot) are deliberately left out of the training group.
      {
        userAgent: ['*'],
        // The site summary advertises the MCP server, which lives under /api/. The
        // longer Allow wins over the Disallow (RFC 9309).
        allow: ['/', MCP_ENDPOINT],
        disallow: ['/api/', '/studio'],
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
