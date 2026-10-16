import { StudioError } from '../../studio/errors';

export class SpotifyError extends StudioError {
  constructor(
    readonly providerStatus: number,
    readonly retryAfter: number | null = null
  ) {
    super(
      providerStatus === 429 ? 429 : providerStatus === 401 ? 401 : 502,
      providerStatus === 429
        ? 'Spotify is busy. Retry after the indicated pause.'
        : providerStatus === 401
          ? 'Reconnect Spotify to continue.'
          : `Spotify could not complete this request (${providerStatus}).`,
      retryAfter !== null && retryAfter !== 0 && !Number.isNaN(retryAfter)
        ? { retryAfter }
        : undefined
    );
  }
}
export class SpotifyClient {
  constructor(
    private token: string,
    private request: typeof fetch = fetch
  ) {}
  async get(path: string): Promise<Record<string, unknown>> {
    const url = new URL(path, 'https://api.spotify.com/v1/');
    if (
      url.origin !== 'https://api.spotify.com' ||
      !url.pathname.startsWith('/v1/')
    )
      throw new Error('Invalid Spotify API destination.');
    const response = await this.request(url, {
      headers: { Authorization: `Bearer ${this.token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok)
      throw new SpotifyError(
        response.status,
        response.status === 429
          ? Math.max(1, spotifyRetryAfter(response.headers.get('retry-after')))
          : null
      );
    return response.json();
  }
  async pages<T = unknown>(path: string): Promise<T[]> {
    const items: T[] = [];
    let next: string | null = path;
    const seen = new Set<string>();
    while (next) {
      if (seen.has(next) || seen.size >= 1000)
        throw new Error('Spotify pagination did not complete.');
      seen.add(next);
      const page = await this.get(next);
      if (!Array.isArray(page.items))
        throw new Error('Spotify returned invalid items.');
      items.push(...page.items);
      next = (page.next as string | null | undefined) ?? null;
    }
    return items;
  }
}

export function spotifyRetryAfter(header: string | null): number {
  const seconds = Number(header);
  return seconds === 0 || Number.isNaN(seconds) ? 60 : seconds;
}
