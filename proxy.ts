import { type NextRequest, NextResponse } from 'next/server';

import { isLiveMode } from '@/lib/site-mode';

const ALLOWED_HIATUS_PREFIXES = ['/_next/', '/_vercel/'];
const BLOCKED_HIATUS_PATHS = new Set([
  '/about',
  '/apps',
  '/bio',
  '/colophon',
  '/contact',
  '/design',
  '/hi',
  '/media',
  '/now',
  '/projects',
  '/random',
  '/research',
  '/writings',
]);

function isAllowedHiatusPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    ALLOWED_HIATUS_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function isBlockedHiatusPath(pathname: string): boolean {
  return [...BLOCKED_HIATUS_PATHS].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isLiveMode() || isAllowedHiatusPath(pathname)) {
    return;
  }

  if (!isBlockedHiatusPath(pathname)) {
    return;
  }

  const notFoundUrl = request.nextUrl.clone();
  notFoundUrl.pathname = '/_not-found';
  notFoundUrl.search = '';

  return NextResponse.rewrite(notFoundUrl, {
    status: 404,
    headers: {
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
