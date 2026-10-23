import type { CDPSession, Page } from '@playwright/test';

export type TransferCategory =
  | 'html'
  | 'rsc'
  | 'js'
  | 'css'
  | 'images'
  | 'json'
  | 'other';
type Categories = Record<TransferCategory, number>;
interface RequestTransfer {
  url: string;
  prefetch: boolean;
  category: TransferCategory;
  status?: number;
  bytes: number;
  offset: number;
  finished: boolean;
  inherited: boolean;
  cached: boolean;
  error?: string;
}
function categories(): Categories {
  return { html: 0, rsc: 0, js: 0, css: 0, images: 0, json: 0, other: 0 };
}
function categoryFor(mimeType: string): TransferCategory {
  const mime = mimeType.split(';')[0]!.trim().toLowerCase();
  const known: Record<string, TransferCategory> = {
    'text/html': 'html',
    'text/x-component': 'rsc',
    'text/javascript': 'js',
    'application/javascript': 'js',
    'text/css': 'css',
    'application/json': 'json',
  };
  if (mime.startsWith('image/')) return 'images';
  if (mime.endsWith('+json')) return 'json';
  return known[mime] ?? 'other';
}
function isPrefetch(headers: Record<string, string>): boolean {
  const normalized = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
  return (
    normalized['next-router-prefetch'] === '1' ||
    /prefetch/i.test(
      `${normalized.purpose ?? ''} ${normalized['sec-purpose'] ?? ''}`
    )
  );
}

function pending(request: RequestTransfer): boolean {
  return !request.finished && request.error === undefined;
}
function allowsIdleResponse(request: RequestTransfer): boolean {
  return (
    request.status !== undefined &&
    (request.category === 'rsc' || request.status >= 400)
  );
}
function phaseBytes(request: RequestTransfer): number {
  return Math.max(0, request.bytes - request.offset);
}

export class TransferLedger {
  private requests = new Map<string, RequestTransfer>();
  private lastActivityAt = Date.now();
  private windowStartedAt = Date.now();
  reset() {
    for (const [id, request] of this.requests) {
      if (!pending(request)) this.requests.delete(id);
      else Object.assign(request, { offset: request.bytes, inherited: true });
    }
    this.windowStartedAt = Date.now();
    this.lastActivityAt = Date.now();
  }
  request(id: string, url: string, headers: Record<string, string>) {
    if (!/^https?:/.test(url)) return;
    const previous = this.requests.get(id);
    if (previous)
      this.requests.set(`${id}:hop:${this.requests.size}`, previous);
    this.requests.set(id, {
      url,
      prefetch: isPrefetch(headers) || previous?.prefetch === true,
      category: 'other',
      bytes: 0,
      offset: 0,
      finished: false,
      inherited: false,
      cached: false,
    });
    this.lastActivityAt = Date.now();
  }
  response(
    id: string,
    mimeType: string,
    status: number,
    encodedHeaderBytes = 0
  ) {
    const request = this.requests.get(id);
    if (!request) return;
    Object.assign(request, { category: categoryFor(mimeType), status });
    if (!request.cached)
      request.bytes = Math.max(request.bytes, encodedHeaderBytes);
    this.lastActivityAt = Date.now();
  }
  cached(id: string) {
    const request = this.requests.get(id);
    if (request) Object.assign(request, { cached: true, bytes: 0 });
  }
  data(id: string, encodedDataLength: number) {
    const request = this.requests.get(id);
    if (!request || request.cached || encodedDataLength <= 0) return;
    request.bytes += encodedDataLength;
    this.lastActivityAt = Date.now();
  }
  finish(id: string, encodedDataLength: number) {
    const request = this.requests.get(id);
    if (!request) return;
    Object.assign(request, { bytes: encodedDataLength, finished: true });
    this.lastActivityAt = Date.now();
  }
  fail(id: string, error: string) {
    const request = this.requests.get(id);
    if (request) request.error = error;
    this.lastActivityAt = Date.now();
  }
  async drain(timeoutMs: number, quietMs = 1_000) {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const unresolved = [...this.requests.values()].some(
        (request) => pending(request) && !allowsIdleResponse(request)
      );
      if (!unresolved && Date.now() - this.lastActivityAt >= quietMs) {
        return {
          ...this.snapshot(),
          settlement: { status: 'quiet', quietMs, timeoutMs },
        };
      }
      if (Date.now() >= deadline)
        return {
          ...this.snapshot(),
          settlement: { status: 'timeout', quietMs, timeoutMs },
        };
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(25, Math.max(1, deadline - Date.now())))
      );
    }
  }
  snapshot() {
    const byCategory = categories();
    const prefetch = { bytes: 0, requests: 0, byCategory: categories() };
    const requests = [...this.requests.values()];
    for (const request of requests) {
      const bytes = phaseBytes(request);
      if (request.prefetch) {
        prefetch.bytes += bytes;
        prefetch.requests += 1;
        prefetch.byCategory[request.category] += bytes;
      } else byCategory[request.category] += bytes;
    }
    const pendingRequests = requests
      .filter(pending)
      .map((request) => ({ ...request, bytes: phaseBytes(request) }));
    return {
      source:
        'CDP encoded response headers and data chunks; replaced by loadingFinished terminal totals',
      window: {
        startedAtMs: this.windowStartedAt,
        observedUntilMs: Date.now(),
      },
      bytes: requests.reduce((sum, request) => sum + phaseBytes(request), 0),
      byCategory,
      prefetch,
      requests: requests.length,
      inherited: requests.filter((request) => request.inherited).length,
      completed: requests.filter((request) => request.finished).length,
      failed: requests
        .filter(
          (request) =>
            request.error !== undefined ||
            (request.status !== undefined && request.status >= 400)
        )
        .map((request) => ({ ...request, bytes: phaseBytes(request) })),
      pending: pendingRequests.length,
      pendingRequests,
      unanswered: pendingRequests.filter(
        (request) => request.status === undefined
      ).length,
    };
  }
}

export async function observeTransfers(page: Page) {
  const session: CDPSession = await page.context().newCDPSession(page);
  const ledger = new TransferLedger();
  session.on('Network.requestWillBeSent', (event) => {
    // Redirects reuse a request ID; retain their wire bytes before the next hop.
    if (event.redirectResponse) {
      ledger.response(
        event.requestId,
        event.redirectResponse.mimeType,
        event.redirectResponse.status
      );
      ledger.finish(event.requestId, event.redirectResponse.encodedDataLength);
    }
    ledger.request(event.requestId, event.request.url, event.request.headers);
  });
  session.on('Network.requestServedFromCache', (event) =>
    ledger.cached(event.requestId)
  );
  session.on('Network.responseReceived', (event) => {
    if (event.response.fromDiskCache || event.response.fromPrefetchCache)
      ledger.cached(event.requestId);
    ledger.response(
      event.requestId,
      event.response.mimeType,
      event.response.status,
      event.response.encodedDataLength
    );
  });
  session.on('Network.dataReceived', (event) =>
    ledger.data(event.requestId, event.encodedDataLength)
  );
  session.on('Network.loadingFinished', (event) =>
    ledger.finish(event.requestId, event.encodedDataLength)
  );
  session.on('Network.loadingFailed', (event) =>
    ledger.fail(event.requestId, event.errorText)
  );
  await session.send('Network.enable');
  return { ledger, close: () => session.detach() };
}
