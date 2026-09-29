import { type NextRequest, NextResponse } from 'next/server';

import { tagPath } from '@/lib/writings/tags';

/**
 * The writings index filtered by `?tag=` before each tag had its own page,
 * and old links and bookmarks still carry the query. This lives here rather
 * than in `redirects()` because a config redirect passes every query value
 * through, which left the tag page at `/writings/tags/note?tag=note`.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const tag = url.searchParams.get('tag');
  if (!tag) return NextResponse.next();
  url.searchParams.delete('tag');
  url.pathname = tagPath(tag);
  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: [{ source: '/writings', has: [{ type: 'query', key: 'tag' }] }],
};
