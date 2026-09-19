import { SITE_NAME, SITE_URL } from '@/lib/indieweb/constants';
import { buildOEmbedResponse } from '@/lib/indieweb/oembed';
import { jsonError, jsonResponse } from '@/lib/indieweb/responses';
import { plainTextExcerpt, sameOrigin } from '@/lib/indieweb/utils';
import { absoluteUrl, site } from '@/lib/site';
import { getPublishedWriting } from '@/lib/writings';

/**
 * oEmbed provider endpoint.
 *
 * Embed-aware tools get a small, stable representation for any page on the
 * site. Writings resolve to their real title and description, and a draft
 * or missing writing gets a 404; every other path falls back to a title
 * derived from the last path segment.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const targetUrl = requestUrl.searchParams.get('url');

  if (!targetUrl) return jsonError('missing_url', 400);
  if (!sameOrigin(targetUrl, SITE_URL))
    return jsonError('unsupported_url', 404);

  const target = await describeTarget(targetUrl);
  if (!target) return jsonError('not_found', 404);
  const { title, description } = target;

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

/**
 * A writing address resolves to the writing, or to nothing when it is a
 * draft or does not exist, so an embed never outlives the page it points
 * at. Other paths fall back to a title from the last path segment.
 */
async function describeTarget(
  targetUrl: string
): Promise<{ title: string; description: string } | null> {
  const slug = new URL(targetUrl).pathname.match(
    /^\/writings\/([^/]+)\/?$/
  )?.[1];
  if (slug) {
    try {
      const { writing } = await getPublishedWriting(slug);
      return { title: writing.title, description: writing.description };
    } catch {
      return null;
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
