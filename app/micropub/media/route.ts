import { SITE_URL } from '@/lib/indieweb/constants';
import { getBearerToken, verifyIndieAuthToken } from '@/lib/indieweb/indieauth';
import {
  MediaUploadError,
  getMediaStore,
  parseMediaUpload,
  storeMedia,
} from '@/lib/indieweb/media';
import { jsonError, jsonResponse } from '@/lib/indieweb/responses';

/**
 * Micropub media endpoint, advertised as `media-endpoint` in `q=config`.
 *
 * A client uploads a photo here as the multipart `file` part, gets its URL
 * back in `Location`, and cites that URL as `photo` when it creates the post.
 * Uploads go to public Vercel Blob storage, so without BLOB_READ_WRITE_TOKEN
 * the endpoint answers 503 instead of pretending to keep the file.
 */
export async function POST(request: Request) {
  const store = getMediaStore();
  if (!store) {
    return jsonError(
      'temporarily_unavailable',
      503,
      'Media uploads are not configured: set BLOB_READ_WRITE_TOKEN.'
    );
  }

  const bearer = getBearerToken(request);
  if (!bearer) return jsonError('unauthorized', 401);

  // IndieAuth defines a media scope, but clients such as Quill upload with
  // the create scope they already hold for the post itself.
  const tokenIsValid = await verifyIndieAuthToken({
    bearer,
    expectedMe: SITE_URL,
    requiredScope: ['media', 'create'],
  }).catch(() => false);

  if (!tokenIsValid) return jsonError('forbidden', 403);

  let file: File;
  try {
    file = await parseMediaUpload(request);
  } catch (error) {
    if (error instanceof MediaUploadError) {
      return jsonError('invalid_request', 400, error.message);
    }
    return jsonError('invalid_request', 400);
  }

  try {
    const url = await storeMedia(file, store);
    return jsonResponse({ url }, { status: 201, headers: { Location: url } });
  } catch (error) {
    console.error('Micropub media upload failed:', error);
    return jsonError('server_error', 500, 'The upload could not be stored.');
  }
}
