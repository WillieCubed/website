import { type AddressResolver, systemResolver } from './public-fetch/address';
import {
  type PublicDocument,
  discardResponseBody,
  readCappedBytes,
  readPublicDocument,
} from './public-fetch/body';
import { fetchRedirectedResponse } from './public-fetch/redirects';
import { type DocumentFetch, publicOnlyFetch } from './public-fetch/transport';

export {
  type AddressResolver,
  isCloudflareRuntime,
  isFetchableUrl,
  isPublicAddress,
  systemResolver,
} from './public-fetch/address';
export { type PublicDocument, readCappedText } from './public-fetch/body';
export {
  type DocumentFetch,
  createPublicOnlyAgent,
  createPublicOnlyLookup,
} from './public-fetch/transport';

const PUBLIC_DOCUMENT_MAX_BYTES = 1024 * 1024;

export interface PublicFetchOptions {
  /** Resolves host names; the system resolver by default. */
  resolve?: AddressResolver;
  /** Makes each request; a public-only fetch over `resolve` by default. */
  fetch?: DocumentFetch;
  /** Request headers, such as Accept and User-Agent. */
  headers?: Record<string, string>;
  /** Bytes of body to read at most. */
  maxBytes?: number;
  /** Read bodies only for these MIME types; other responses retain their headers. */
  bodyContentTypes?: readonly string[];
  /** Milliseconds for the whole exchange, redirects included. */
  timeoutMs: number;
  method?: 'GET' | 'HEAD' | 'POST';
  body?: URLSearchParams;
}

/**
 * Fetch a document from a public address. Redirects are followed by hand, at
 * most three, and each one is checked like the first URL. Resolves null when
 * an address is not public http(s), when the redirects run out, or when the
 * body is larger than `maxBytes`. A network error or the timeout throws, so
 * the caller can tell an unreachable host from a refused one.
 */
export async function fetchPublicDocument(
  address: string,
  {
    resolve = systemResolver,
    fetch,
    headers = {},
    maxBytes = PUBLIC_DOCUMENT_MAX_BYTES,
    bodyContentTypes,
    timeoutMs,
    method = 'GET',
    body: requestBody,
  }: PublicFetchOptions
): Promise<PublicDocument | null> {
  const request = fetch ?? publicOnlyFetch(resolve);
  const signal = AbortSignal.timeout(timeoutMs);
  const fetched = await fetchRedirectedResponse(address, request, resolve, {
    headers,
    method,
    ...(requestBody && { body: requestBody }),
    redirect: 'manual',
    signal,
  });
  if (!fetched) return null;
  return readPublicDocument(fetched.response, fetched.url, {
    method,
    bodyContentTypes,
    maxBytes,
  });
}

export interface PublicBytes {
  bytes: Uint8Array;
  mimeType: string;
}

export async function fetchPublicBytes(
  address: string,
  maxBytes: number,
  timeoutMs = 10000
): Promise<PublicBytes | null> {
  const request = publicOnlyFetch(systemResolver);
  const signal = AbortSignal.timeout(timeoutMs);
  const fetched = await fetchRedirectedResponse(
    address,
    request,
    systemResolver,
    { headers: {}, redirect: 'manual', signal }
  );
  if (!fetched) return null;
  const { response } = fetched;
  if (
    !response.ok ||
    Number(response.headers.get('content-length')) > maxBytes
  ) {
    await discardResponseBody(response);
    return null;
  }
  const bytes = await readCappedBytes(response.body, maxBytes);
  return bytes
    ? {
        bytes,
        mimeType:
          response.headers.get('content-type')?.split(';')[0].trim() ?? '',
      }
    : null;
}
