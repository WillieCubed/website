const ALLOWED_METHODS = 'GET, POST, OPTIONS';
const DEFAULT_ALLOWED_HEADERS = 'content-type, accept, mcp-protocol-version';

/**
 * The preflight for a browser-hosted MCP client. The endpoint serves only what
 * the site already publishes and takes no credentials, so any origin may call
 * it and any header the client names is allowed.
 */
export function corsPreflight(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': ALLOWED_METHODS,
      'Access-Control-Allow-Headers':
        request.headers.get('Access-Control-Request-Headers') ??
        DEFAULT_ALLOWED_HEADERS,
      'Access-Control-Max-Age': '86400',
    },
  });
}

/** Adds the origin header a browser needs to read the handler's response. */
export function withCors(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request) => {
    const response = await handler(request);
    const headers = new Headers(response.headers);
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
