import { HttpError } from '@/lib/http/errors';
import { jsonError } from '@/lib/indieweb/responses';

import { MicropubRequestError } from './document-types';
import { MicropubConflictError, MicropubStorageError } from './storage-types';
import { MicropubValidationError } from './validation';

export function postNotFound(): Response {
  return jsonError(
    'invalid_request',
    400,
    'The post with the requested URL was not found.'
  );
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return jsonError(
      error.status >= 500 ? 'temporarily_unavailable' : 'invalid_request',
      error.status,
      error.message
    );
  }
  if (error instanceof MicropubValidationError) {
    return jsonError('invalid_request', 400, error.message);
  }
  if (error instanceof MicropubRequestError) {
    return jsonError('invalid_request', 400, error.description);
  }
  if (error instanceof Error && error.message === 'invalid_request') {
    return jsonError('invalid_request', 400);
  }
  if (error instanceof MicropubConflictError)
    return jsonError('conflict', 409, error.message);
  if (error instanceof MicropubStorageError) {
    console.error('Micropub storage failed:', error.message);
    return jsonError('server_error', 500, error.message);
  }
  console.error('Micropub request failed:', error);
  return jsonError('server_error', 500);
}
