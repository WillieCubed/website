import { isIP } from 'node:net';
import { type Agent, fetch as undiciFetch } from 'undici';

import {
  createPublicOnlyAgent,
  isCloudflareRuntime,
  isPublicAddress,
  readCappedText,
} from '@/lib/indieweb/public-fetch';

let dispatcher: Agent | undefined;

export interface OAuthTransportRequest extends RequestInit {
  dispatcher?: Agent;
  duplex: 'half';
}

export interface OAuthTransportResponse {
  status: number;
  headers: HeadersInit;
  body: ReadableStream<Uint8Array> | null;
}

export type OAuthTransport = (
  url: URL,
  init: OAuthTransportRequest
) => Promise<OAuthTransportResponse>;

const transport: OAuthTransport = async (url, init) => {
  if (isCloudflareRuntime()) {
    return fetch(url, {
      method: init.method,
      headers: init.headers,
      body: init.body,
      signal: init.signal,
      redirect: 'manual',
    });
  }
  return undiciFetch(
    url,
    init as Parameters<typeof undiciFetch>[1]
  ) as unknown as Promise<OAuthTransportResponse>;
};

function publicOAuthEndpoint(input: RequestInfo | URL): URL {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('OAuth endpoints must use public HTTPS.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) !== 0 && !isPublicAddress(host))
    throw new Error('OAuth endpoints must use public HTTPS.');
  return url;
}

export function createOAuthFetch(
  fetcher: OAuthTransport = transport
): typeof globalThis.fetch {
  return async (input, init) => {
    // The SDK puts DPoP, authorization and POST bodies on Request itself.
    const url = publicOAuthEndpoint(input);
    const request = new Request(input, init);
    const response = await fetcher(url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      duplex: 'half',
      signal: AbortSignal.any([AbortSignal.timeout(15000), request.signal]),
      redirect: 'error',
      dispatcher: isCloudflareRuntime()
        ? undefined
        : (dispatcher ??= createPublicOnlyAgent()),
    });
    if (response.status >= 300 && response.status < 400)
      throw new Error('OAuth endpoints may not redirect.');
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
