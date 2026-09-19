import type { MetadataRoute } from 'next';

import { MCP_ENDPOINT } from '@/lib/mcp/constants';
import { absoluteUrl } from '@/lib/site';

/**
 * Generates a robots.txt file for the website.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ['*'],
        // llms.txt advertises the MCP server, which lives under /api/. The
        // longer Allow wins over the Disallow (RFC 9309).
        allow: ['/', MCP_ENDPOINT],
        disallow: ['/api/', '/admin/', '/hi/'],
      },
      // AI training crawlers stay out of the writings. Search crawlers and
      // link-preview bots (Slackbot, LinkedInBot, facebookexternalhit,
      // Twitterbot) are deliberately not listed, so results and unfurls work.
      // Google-Extended is the real opt-out token for Gemini training;
      // Googlebot-Extended is not a token and did nothing.
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'Google-Extended',
          'ClaudeBot',
          'anthropic-ai',
          'Applebot-Extended',
          'meta-externalagent',
          'FacebookBot',
          'CCBot',
          'Omgilibot',
        ],
        disallow: ['/writings/'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
