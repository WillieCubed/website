import { SITE_URL } from '@/lib/indieweb/constants';
import { getBearerToken, micropubTokenStatus } from '@/lib/indieweb/indieauth';
import {
  type MediaStore,
  MediaUploadError,
  getMediaStore,
  parseMediaUpload,
  readBoundedMediaRequest,
  storeMedia,
} from '@/lib/indieweb/media';
import {
  authorizationError,
  readMicropubAccessToken,
  withMicropubCors,
} from '@/lib/indieweb/micropub-endpoint';
import { jsonError, jsonResponse } from '@/lib/indieweb/responses';
import type { IndieAuthStore } from '@/lib/indieweb/types';

export interface MediaEndpointOptions {
  mediaStore?: MediaStore | null;
  tokenStore?: IndieAuthStore;
  now?: () => Date;
}

export async function handleMediaPost(
  request: Request,
  options: MediaEndpointOptions = {}
): Promise<Response> {
  return withMicropubCors(await upload(request, options));
}

async function upload(
  request: Request,
  options: MediaEndpointOptions
): Promise<Response> {
  const store =
    options.mediaStore === undefined ? getMediaStore() : options.mediaStore;
  if (!store)
    return jsonError(
      'temporarily_unavailable',
      503,
      'Media uploads are not configured: connect a Vercel Blob store or set BLOB_READ_WRITE_TOKEN.'
    );
  try {
    // Check a header credential before reading file bytes. Form credentials
    // need a bounded body before they can be checked.
    const header = getBearerToken(request);
    let bounded: Request | undefined;
    if (!header) bounded = await readBoundedMediaRequest(request);
    const access = header
      ? { token: header }
      : await readMicropubAccessToken(bounded!);
    if ('error' in access)
      return authorizationError(
        access.error,
        access.error === 'unauthorized' ? 401 : 400
      );
    const status = await micropubTokenStatus({
      bearer: access.token,
      expectedMe: SITE_URL,
      requiredScope: ['media', 'create', 'draft'],
      store: options.tokenStore,
      now: options.now?.(),
    }).catch(() => 'unavailable');
    if (status === 'invalid') return authorizationError('invalid_token', 401);
    if (status === 'insufficient_scope')
      return authorizationError('insufficient_scope', 403, [
        'media',
        'create',
        'draft',
      ]);
    if (status === 'unavailable')
      return jsonError('temporarily_unavailable', 503);
    bounded ??= await readBoundedMediaRequest(request);
    const transport = await readMicropubAccessToken(bounded);
    if ('error' in transport)
      return authorizationError(
        transport.error,
        transport.error === 'unauthorized' ? 401 : 400
      );
    const file = await parseMediaUpload(bounded);
    const url = await storeMedia(file, store, options.now?.());
    return jsonResponse({ url }, { status: 201, headers: { Location: url } });
  } catch (error) {
    if (error instanceof MediaUploadError)
      return jsonError('invalid_request', error.status, error.message);
    console.error('Micropub media upload failed:', error);
    return jsonError('server_error', 500, 'The upload could not be stored.');
  }
}
