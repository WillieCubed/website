import { fetchWithDeadline } from '@/lib/http/fetch';

import type { PublicStatus } from './types';

interface StatusRequest {
  controller: AbortController;
  readers: Set<AbortSignal>;
  result: Promise<PublicStatus | null>;
}
let pending: StatusRequest | undefined;

/** Share only an in-flight public read; freshness remains with each mounted owner. */
export function requestStatus(
  signal: AbortSignal
): Promise<PublicStatus | null> {
  if (signal.aborted) return Promise.resolve(null);
  const request =
    pending && !pending.controller.signal.aborted ? pending : startRequest();
  request.readers.add(signal);
  const leave = () => {
    request.readers.delete(signal);
    if (request.readers.size === 0) request.controller.abort();
  };
  signal.addEventListener('abort', leave, { once: true });
  return request.result.finally(() => {
    request.readers.delete(signal);
    signal.removeEventListener('abort', leave);
  });
}

function startRequest(): StatusRequest {
  const controller = new AbortController();
  const request: StatusRequest = {
    controller,
    readers: new Set(),
    result: fetchWithDeadline('/api/status', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) =>
        response.ok ? (response.json() as Promise<PublicStatus>) : null
      )
      .finally(() => {
        if (pending === request) pending = undefined;
      }),
  };
  pending = request;
  return request;
}
