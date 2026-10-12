import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import type { OwnerAuthenticator } from '@/lib/indieweb/types';

import { adminView } from './admin-view';
import { citySchema, resolveLocation, searchCities } from './location';
import type { StatusStore } from './store';

const COOKIE = 'status_admin';
const SESSION_SECONDS = 8 * 60 * 60;
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
const csrfFor = (token: string) =>
  createHmac('sha256', token).update('status-admin-form').digest('hex');
function cookie(request: Request) {
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
function validCsrf(value: FormDataEntryValue | null, token: string) {
  const expected = csrfFor(token);
  return (
    typeof value === 'string' &&
    value.length === expected.length &&
    timingSafeEqual(Buffer.from(value), Buffer.from(expected))
  );
}
export function createAdminHandler({
  store,
  owner,
  invalidate,
  secure = true,
  configured = true,
  search = searchCities,
}: {
  store: StatusStore;
  owner: OwnerAuthenticator | null;
  invalidate: () => void;
  secure?: boolean;
  configured?: boolean;
  search?: typeof searchCities;
}) {
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'same-origin',
    'X-Robots-Tag': 'noindex, nofollow',
    'Content-Security-Policy':
      "default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  };
  const enabled = configured && owner !== null;
  const render = (options: Parameters<typeof adminView>[0], status = 200) =>
    new Response(adminView(options), { status, headers });
  const redirect = (
    request: Request,
    {
      token,
      clear = false,
      saved = false,
    }: { token?: string; clear?: boolean; saved?: boolean } = {}
  ) => {
    const response = new Response(null, {
      status: 303,
      headers: {
        ...headers,
        Location: new URL(
          saved ? '/admin/status?saved=1' : '/admin/status',
          request.url
        ).href,
      },
    });
    if (token || clear)
      response.headers.set(
        'Set-Cookie',
        `${COOKIE}=${token ?? ''}; Path=/admin/status; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : SESSION_SECONDS}${secure ? '; Secure' : ''}`
      );
    return response;
  };
  return async (request: Request): Promise<Response> => {
    if (!enabled) return render({ configured: false }, 503);
    try {
      const token = cookie(request);
      const signedIn = !!token && (await store.hasSession(tokenHash(token)));
      if (request.method === 'GET') {
        if (!signedIn) return render({ configured: true });
        const query = new URL(request.url).searchParams.get('q') ?? '';
        let results: Awaited<ReturnType<typeof search>> = [];
        let message =
          new URL(request.url).searchParams.get('saved') === '1'
            ? 'City updated.'
            : '';
        try {
          if (query) results = await search(query);
        } catch {
          message = 'Search is unavailable. Try again.';
        }
        return render({
          configured: true,
          signedIn,
          csrf: csrfFor(token!),
          snapshot: await resolveLocation(store),
          results,
          query,
          message,
        });
      }
      if (request.method !== 'POST')
        return new Response(null, {
          status: 405,
          headers: { ...headers, Allow: 'GET, POST' },
        });
      if (request.headers.get('origin') !== new URL(request.url).origin)
        return new Response('Request origin rejected.', {
          status: 403,
          headers,
        });
      if (
        !request.headers
          .get('content-type')
          ?.startsWith('application/x-www-form-urlencoded')
      )
        return new Response('Unsupported form.', { status: 415, headers });
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      if (reader) {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > 8192) {
            await reader.cancel();
            break;
          }
          chunks.push(value);
        }
      }
      if (length > 8192)
        return new Response('Form too large.', { status: 413, headers });
      const body = Buffer.concat(chunks).toString('utf8');
      const form = new FormData();
      new URLSearchParams(body).forEach((value, key) =>
        form.append(key, value)
      );
      if (form.get('action') === 'signin') {
        const check = await owner!.verify(request, form);
        if (!check.ok)
          return render(
            {
              configured: true,
              message:
                check.reason === 'locked'
                  ? 'Sign-in is paused after too many failed attempts.'
                  : 'That code is invalid or has already been used.',
            },
            check.reason === 'locked' ? 429 : 401
          );
        if (signedIn) await store.deleteSession(tokenHash(token!));
        const next = randomBytes(32).toString('hex');
        await store.createSession(
          tokenHash(next),
          new Date(Date.now() + SESSION_SECONDS * 1000)
        );
        return redirect(request, { token: next });
      }
      if (!signedIn)
        return render(
          { configured: true, message: 'Sign in before editing your status.' },
          401
        );
      if (!validCsrf(form.get('csrf'), token!))
        return new Response('Form expired. Reload and try again.', {
          status: 403,
          headers,
        });
      if (form.get('action') === 'signout') {
        await store.deleteSession(tokenHash(token!));
        return redirect(request, { clear: true });
      }
      if (form.get('action') !== 'save')
        return new Response('Unknown action.', { status: 400, headers });
      let city;
      try {
        city = citySchema.parse(JSON.parse(String(form.get('city'))));
      } catch {
        return new Response('Invalid city. Search again and choose a result.', {
          status: 400,
          headers,
        });
      }
      await store.save(city);
      invalidate();
      return redirect(request, { saved: true });
    } catch (error) {
      console.error(
        'Status admin request failed',
        error instanceof Error ? error.name : 'Unknown error'
      );
      return render(
        {
          configured: true,
          message: 'Status storage is unavailable. Reload before retrying.',
        },
        503
      );
    }
  };
}
