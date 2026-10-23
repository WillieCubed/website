import { authorize } from './access';
import { type MicropubAction, readMicropubAction } from './actions';
import { createWriting, mutateWriting } from './mutations';
import type { MicropubEndpointOptions } from './options';
import { micropubGet } from './queries';
import { errorResponse } from './responses';

export {
  readMicropubAccessToken,
  authorizationError,
  type MicropubAccessTokenResult,
} from './access';
export type { MicropubEndpointOptions } from './options';

/**
 * Create, update, or delete a writing. Each needs the scope of the same
 * name.
 *
 * Drafts always use durable private studio revisions. With studio storage
 * configured, publication exports an explicitly selected saved revision.
 * Existing published-only deployments retain GitHub Contents API or writable
 * checkout publication for compatibility; drafts never use either fallback.
 */
async function micropubPost(
  request: Request,
  options: MicropubEndpointOptions = {}
): Promise<Response> {
  // A malformed body is reported after the token is checked, so a client
  // with a bad token hears about the token first.
  let action: MicropubAction | undefined;
  let actionError: unknown;
  try {
    action = await readMicropubAction(request);
  } catch (error) {
    actionError = error;
  }

  const denied = await authorize(
    request,
    action?.action === 'create' ? ['create', 'draft'] : action?.action,
    options
  );
  if (denied) return denied;
  if (!action) return errorResponse(actionError);

  try {
    if (action.action === 'create')
      return await createWriting(request, options);
    return await mutateWriting(action, options);
  } catch (error) {
    return errorResponse(error);
  }
}

const MICROPUB_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Expose-Headers': 'Location, WWW-Authenticate',
};

export function micropubCorsPreflight(): Response {
  return new Response(null, { status: 204, headers: MICROPUB_CORS });
}

export function withMicropubCors(response: Response): Response {
  for (const [key, value] of Object.entries(MICROPUB_CORS))
    response.headers.set(key, value);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function handleMicropubGet(
  request: Request,
  options: MicropubEndpointOptions = {}
): Promise<Response> {
  return withMicropubCors(await micropubGet(request, options));
}
export async function handleMicropubPost(
  request: Request,
  options: MicropubEndpointOptions = {}
): Promise<Response> {
  return withMicropubCors(await micropubPost(request, options));
}
