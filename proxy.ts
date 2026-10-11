import { NextRequest, NextResponse } from 'next/server';

import { authorizeStudio } from '@/lib/studio/auth';
import { isPrivatePreview, privateHeaders } from '@/lib/studio/config';
import { StudioError } from '@/lib/studio/errors';
import { tagPath } from '@/lib/writings/tags';

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (!isPrivatePreview()) {
    if (/^\/(?:studio|api\/studio)(?:\/|$)/.test(path))
      return new NextResponse('Not found', { status: 404 });
    const tag =
      path === '/writings' ? request.nextUrl.searchParams.get('tag') : null;
    if (tag) {
      const target = request.nextUrl.clone();
      target.searchParams.delete('tag');
      target.pathname = tagPath(tag);
      return NextResponse.redirect(target, 308);
    }
    return NextResponse.next();
  }
  return privateProxy(request);
}

async function privateProxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  try {
    await authorizeStudio(request);
  } catch (error) {
    return new NextResponse(
      error instanceof StudioError ? error.message : 'Preview access denied',
      {
        status: error instanceof StudioError ? error.status : 403,
        headers: privateHeaders,
      }
    );
  }
  // A private preview never syndicates or advertises protocol endpoints.
  if (
    /\/feed(?:\.|\/|$)|\/activity\/|^\/(?:sitemap\.xml|llms\.txt|oembed|mcp|micropub|webmentions?|indieauth|\.well-known|opensearch\.xml)(?:\/|$)|^\/api\/(?:indieweb|webmention|atproto|mcp|search\/reindex)/.test(
      path
    )
  )
    return new NextResponse('Not found', {
      status: 404,
      headers: privateHeaders,
    });
  const target = request.nextUrl.clone();
  let response: NextResponse;
  if (/^\/writings(?:\/|$)/.test(path) && !/opengraph-image/.test(path)) {
    target.pathname = '/studio/read' + path.slice('/writings'.length);
    response = NextResponse.rewrite(target);
  } else response = NextResponse.next();
  for (const [key, value] of Object.entries(privateHeaders))
    response.headers.set(key, value);
  return response;
}

// Every preview path, including static assets and direct-origin URLs, is authenticated.
export const config = { matcher: ['/:path*'] };
