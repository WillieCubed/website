import { fetchWithDeadline } from '@/lib/http/fetch';
import type { AdminState } from '@/lib/status/admin-state';

interface AdminStatusResponse extends AdminState {
  redirect?: string;
}

const endpoint = '/api/admin/status';
async function readResponse(response: Response): Promise<AdminStatusResponse> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || 'Request failed. Try again.');
  }
}

/** A debounced request owns abort and invalidates late results when cancelled. */
export function scheduleCitySearch(
  query: string,
  receive: (response: Response, next: AdminState) => void,
  setMessage: (message: string) => void
) {
  const abort = new AbortController();
  const timer = setTimeout(async () => {
    setMessage('Searching…');
    try {
      const response = await fetchWithDeadline(
        `${endpoint}?edit=1&q=${encodeURIComponent(query.trim())}`,
        { signal: abort.signal, cache: 'no-store' }
      );
      const next = await readResponse(response);
      if (!abort.signal.aborted) receive(response, next);
    } catch (error) {
      if (!abort.signal.aborted)
        setMessage(
          error instanceof Error
            ? error.message
            : 'Search is unavailable. Try again.'
        );
    }
  }, 300);
  return () => {
    clearTimeout(timer);
    abort.abort();
  };
}

export async function submitStatus(fields: Record<string, string>) {
  let response = await fetchWithDeadline(endpoint, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: new URLSearchParams(fields),
  });
  let next = await readResponse(response);
  if (next.redirect) {
    const destination = new URL(next.redirect, window.location.origin);
    response = await fetchWithDeadline(`${endpoint}${destination.search}`, {
      cache: 'no-store',
    });
    next = await readResponse(response);
  }
  return { response, next };
}
