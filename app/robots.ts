import type { MetadataRoute } from 'next';

/**
 * Generates a robots.txt file for the website.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ['*'],
        allow: '/',
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
    sitemap: `${process.env.BASE_URL}/sitemap.xml`,
  };
}
