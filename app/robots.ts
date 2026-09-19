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
      // Maybe reconsider this?
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'Googlebot-Extended',
          'CCBot',
          'anthropic-ai',
          'Omgilibot',
          'FacebookBot',
        ],
        disallow: ['/writings/'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
