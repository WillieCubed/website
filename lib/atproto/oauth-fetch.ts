import { fetch as undiciFetch } from 'undici';

import {
  createPublicOnlyAgent,
  readCappedText,
} from '@/lib/indieweb/public-fetch';

const dispatcher = createPublicOnlyAgent();
type Transport = (
  url: URL,
  init: RequestInit & { dispatcher: typeof dispatcher; duplex: 'half' }
) => Promise<{
  status: number;
  headers: HeadersInit;
  body: ReadableStream<Uint8Array> | null;
}>;
const transport: Transport = async (url, init) =>
  undiciFetch(
    url,
    init as Parameters<typeof undiciFetch>[1]
  ) as unknown as ReturnType<Transport>;

export function createOAuthFetch(
  fetcher: Transport = transport
): typeof globalThis.fetch {
  return async (input, init) => {
    // The SDK puts DPoP, authorization and POST bodies on Request itself.
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.protocol !== 'https:' || url.username || url.password)
      throw new Error('OAuth endpoints must use public HTTPS.');
    const request = new Request(input, init);
    const response = await fetcher(url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      duplex: 'half',
      signal: AbortSignal.any([AbortSignal.timeout(15000), request.signal]),
      redirect: 'error',
      dispatcher,
    });
    const text = await readCappedText(response.body, 2 * 1024 * 1024);
    if (text === null)
      throw new Error('The OAuth provider response is too large.');
    return new Response(
      [204, 205, 304].includes(response.status) ? null : text,
      {
        status: response.status,
        headers: response.headers,
      }
    );
  };
}

/** Account-supplied endpoints use guarded public sockets and cannot redirect. */
export const oauthFetch = createOAuthFetch();
