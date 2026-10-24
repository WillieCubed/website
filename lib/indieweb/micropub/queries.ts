import {
  jsonError,
  jsonResponse,
  noStoreJsonHeaders,
} from '@/lib/indieweb/responses';
import { absoluteRoute } from '@/lib/site/urls';
import { getAllWritings } from '@/lib/writings/index';
import { groupByTag, normalizeTag } from '@/lib/writings/tags';

import { authorize } from './access';
import { getMicropubConfig, getMicropubSyndicationTargets } from './create';
import { micropubSource } from './document';
import { type MicropubEndpointOptions, micropubEnvironment } from './options';
import { errorResponse, postNotFound } from './responses';
import { findStoredWriting } from './store';

/**
 * Micropub queries. `config`, `syndicate-to`, and `category` describe the
 * site and are public. `source` returns a post's own properties, drafts
 * included, so it needs a token for this site, with any scope.
 */
export async function micropubGet(
  request: Request,
  options: MicropubEndpointOptions = {}
): Promise<Response> {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (query === 'config') {
    return jsonResponse(getMicropubConfig());
  }

  if (query === 'syndicate-to') {
    return jsonResponse({ 'syndicate-to': getMicropubSyndicationTargets() });
  }

  if (query === 'category') {
    const tags = await (options.publishedTags ?? publishedTags)();
    const filter = normalizeTag(url.searchParams.get('filter') ?? '');
    return jsonResponse({
      categories: tags.filter((tag) => tag.startsWith(filter)),
    });
  }

  if (query === 'source') {
    const denied = await authorize(request, undefined, options);
    if (denied) return denied;
    return source(url, options);
  }

  if (query) {
    return jsonError('invalid_request', 400, `Unsupported query "${query}".`);
  }

  return new Response('OK', { status: 200 });
}

// The query needs no token, so it lists only tags a production visitor can
// already see, even on a server that shows drafts.
async function publishedTags(): Promise<string[]> {
  return groupByTag(await getAllWritings(false)).map(({ tag }) => tag);
}

async function source(
  url: URL,
  options: MicropubEndpointOptions
): Promise<Response> {
  const target = url.searchParams.get('url');
  if (!target) {
    return jsonError('invalid_request', 400, 'q=source needs a url.');
  }
  try {
    const stored = await findStoredWriting(
      target,
      options.environment ?? micropubEnvironment(),
      options.fetch,
      options
    );
    if (!stored) return postNotFound();
    return jsonResponse(
      micropubSource(stored.source, absoluteRoute`/writings/${stored.slug}`, [
        ...url.searchParams.getAll('properties[]'),
        ...url.searchParams.getAll('properties'),
      ]),
      { headers: noStoreJsonHeaders() }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
