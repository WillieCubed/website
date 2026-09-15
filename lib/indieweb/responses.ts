import type { IndieWebJsonError, JsonResponseInit } from '@/lib/indieweb/types';

export function jsonResponse<TBody>(
  body: TBody,
  init: JsonResponseInit = {}
): Response {
  return Response.json(body, {
    status: init.status ?? 200,
    headers: init.headers,
  });
}

export function jsonError(
  error: string,
  status: number,
  errorDescription?: string
): Response {
  const body: IndieWebJsonError = {
    error,
    error_description: errorDescription,
  };
  return jsonResponse(body, { status });
}

export function noStoreJsonHeaders(): HeadersInit {
  return {
    'Cache-Control': 'no-store',
  };
}
