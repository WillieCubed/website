import type { OwnerAuthenticator } from '@/lib/indieweb/types';

import type { AdminState } from './admin-state';
import { citySchema, resolveLocation, searchCities } from './location';
import type { StatusStore } from './store';

const responseHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; connect-src 'self'; style-src 'unsafe-inline'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

function redirect(request: Request, saved = false): Response {
  const location = new URL(
    saved ? '/admin/status?saved=1' : '/admin/status',
    request.url
  ).href;
  if (request.headers.get('accept')?.includes('application/json')) {
    return Response.json({ redirect: location }, { headers: responseHeaders });
  }
  return new Response(null, {
    status: 303,
    headers: { ...responseHeaders, Location: location },
  });
}

export function createAdminHandler({
  store,
  owner,
  invalidate,
  configured = true,
  search = searchCities,
}: {
  store: StatusStore;
  owner: OwnerAuthenticator | null;
  invalidate: () => void;
  configured?: boolean;
  search?: typeof searchCities;
}) {
  const render = (options: AdminState, status = 200) =>
    Response.json(options, { status, headers: responseHeaders });
  return async (request: Request): Promise<Response> => {
    if (!configured || !owner) return render({ configured: false }, 503);
    try {
      const identity = await owner.verify(request);
      if (!identity.ok)
        return render(
          { configured: true, message: 'Sign in with Cloudflare Access.' },
          401
        );

      if (request.method === 'GET') {
        const url = new URL(request.url);
        const query = url.searchParams.get('q') ?? '';
        let results: Awaited<ReturnType<typeof search>> = [];
        let message =
          url.searchParams.get('saved') === '1' ? 'City updated.' : '';
        try {
          if (query) results = await search(query);
        } catch {
          message = 'Search is unavailable. Try again.';
        }
        return render({
          configured: true,
          signedIn: true,
          snapshot: await resolveLocation(store),
          results,
          query,
          editing: url.searchParams.get('edit') === '1' || !!query,
          message,
        });
      }
      if (request.method !== 'POST')
        return new Response(null, {
          status: 405,
          headers: { ...responseHeaders, Allow: 'GET, POST' },
        });
      if (request.headers.get('origin') !== new URL(request.url).origin)
        return new Response('Request origin rejected.', {
          status: 403,
          headers: responseHeaders,
        });
      const fetchSite = request.headers.get('sec-fetch-site');
      if (fetchSite && !['same-origin', 'none'].includes(fetchSite))
        return new Response('Request origin rejected.', {
          status: 403,
          headers: responseHeaders,
        });
      if (
        !request.headers
          .get('content-type')
          ?.startsWith('application/x-www-form-urlencoded')
      )
        return new Response('Unsupported form.', {
          status: 415,
          headers: responseHeaders,
        });
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
        return new Response('Form too large.', {
          status: 413,
          headers: responseHeaders,
        });
      const form = new FormData();
      new URLSearchParams(Buffer.concat(chunks).toString('utf8')).forEach(
        (value, key) => form.append(key, value)
      );
      if (form.get('action') !== 'save')
        return new Response('Unknown action.', {
          status: 400,
          headers: responseHeaders,
        });
      let city;
      try {
        city = citySchema.parse(JSON.parse(String(form.get('city'))));
      } catch {
        return new Response('Invalid city. Search again and choose a result.', {
          status: 400,
          headers: responseHeaders,
        });
      }
      const previous = await resolveLocation(store);
      try {
        await store.save(city);
      } catch {
        return render(
          {
            configured: true,
            signedIn: true,
            snapshot: previous,
            editing: true,
            query: city.city,
            results: [city],
            message: 'Could not save. Try again.',
          },
          503
        );
      }
      invalidate();
      return redirect(request, true);
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
