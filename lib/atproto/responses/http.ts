import { blueskyAppview } from '@/lib/atproto/config';
import { oauthFetch } from '@/lib/atproto/oauth-fetch';

export async function query<T>(
  method: string,
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<T> {
  const url = new URL(`/xrpc/${method}`, blueskyAppview());
  url.search = new URLSearchParams(params).toString();
  signal?.throwIfAborted();
  const response = await oauthFetch(url, { signal });
  if (!response.ok)
    throw new Error(`Bluesky responses unavailable (${response.status}).`);
  return response.json();
}
export async function pages<T>(
  method: string,
  uri: string,
  property: string,
  signal?: AbortSignal
): Promise<T[]> {
  const values: T[] = [];
  let cursor: string | undefined;
  // Bound remote work; a popular post must not exhaust a serverless invocation.
  for (let page = 0; page < 10; page++) {
    const result = await query<Record<string, unknown>>(
      method,
      {
        uri,
        limit: '100',
        ...(cursor && { cursor }),
      },
      signal
    );
    if (!Array.isArray(result[property]))
      throw new Error('The AppView response has no result list.');
    values.push(...(result[property] as T[]));
    const next = result.cursor as string | undefined;
    if (!next || next === cursor) break;
    cursor = next;
  }
  return values;
}
