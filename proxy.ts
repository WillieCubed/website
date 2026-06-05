import type { NextRequest } from 'next/server';

import { isLiveMode } from '@/lib/site-mode';

const ALLOWED_HIATUS_PREFIXES = ['/_next/', '/_vercel/'];

function isAllowedHiatusPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    ALLOWED_HIATUS_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

export function proxy(request: NextRequest) {
  if (isLiveMode() || isAllowedHiatusPath(request.nextUrl.pathname)) {
    return;
  }

  return new Response('Not found', {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
