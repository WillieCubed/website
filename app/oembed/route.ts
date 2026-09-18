import { SITE_NAME, SITE_URL } from '@/lib/indieweb/constants';
import { buildOEmbedResponse } from '@/lib/indieweb/oembed';
import { jsonError, jsonResponse } from '@/lib/indieweb/responses';
import { plainTextExcerpt, sameOrigin } from '@/lib/indieweb/utils';
import { absoluteUrl, site } from '@/lib/site';
import { getWriting } from '@/lib/writings';

/**
 * oEmbed provider endpoint.
 *
 * Embed-aware tools get a small, stable representation for any page on the
 * site. Writings resolve to their real title and description; every other
 * path falls back to a title derived from the last path segment.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const targetUrl = requestUrl.searchParams.get('url');

  if (!targetUrl) return jsonError('missing_url', 400);
  if (!sameOrigin(targetUrl, SITE_URL))
    return jsonError('unsupported_url', 404);

  const { title, description } = await describeTarget(targetUrl);

  return jsonResponse(
    buildOEmbedResponse({
      targetUrl,
      title,
      description,
      thumbnailUrl: absoluteUrl(site.ogImage),
    }),
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  );
}

async function describeTarget(
  targetUrl: string
): Promise<{ title: string; description: string }> {
  const slug = new URL(targetUrl).pathname.match(
    /^\/writings\/([^/]+)\/?$/
  )?.[1];
  if (slug) {
    try {
      const { writing } = await getWriting(slug);
      return { title: writing.title, description: writing.description };
    } catch {
      // Not a writing; fall through to the path-derived title.
    }
  }
  return { title: titleFromUrl(targetUrl), description: site.shortDescription };
}

function titleFromUrl(targetUrl: string): string {
  const path = new URL(targetUrl).pathname;
  const lastSegment = path.split('/').filter(Boolean).at(-1);
  if (!lastSegment) return SITE_NAME;

  return plainTextExcerpt(lastSegment.split('-').map(capitalize).join(' '), 80);
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
