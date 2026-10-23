import { type AddressResolver, isFetchableUrl } from './address';
import { discardResponseBody } from './body';
import type { DocumentFetch, DocumentFetchRequest } from './transport';

const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function redirectDestination(
  response: Response,
  current: URL,
  method: string
): Promise<URL | null> {
  await discardResponseBody(response);
  if (method === 'POST') return null;
  const location = response.headers.get('location');
  return location ? new URL(location, current) : null;
}

export async function fetchRedirectedResponse(
  address: string,
  request: DocumentFetch,
  resolve: AddressResolver,
  init: DocumentFetchRequest
): Promise<{ response: Response; url: URL } | null> {
  let current = new URL(address);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isFetchableUrl(current, resolve))) return null;
    const response = await request(current.href, init);
    if (!REDIRECT_STATUSES.has(response.status))
      return { response, url: current };
    const redirect = await redirectDestination(
      response,
      current,
      init.method ?? 'GET'
    );
    if (!redirect) return null;
    current = redirect;
  }
  return null;
}
