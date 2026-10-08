import {
  corsPreflight,
  handleUserInfo,
} from '@/lib/indieweb/indieauth-endpoints';
import { indieAuthEndpointOptions } from '@/lib/indieweb/indieauth-storage';
import { jsonError } from '@/lib/indieweb/responses';

export async function GET(request: Request) {
  try {
    return await handleUserInfo(request, indieAuthEndpointOptions());
  } catch (error) {
    console.error('IndieAuth user information request failed:', error);
    return jsonError('server_error', 500);
  }
}

export function OPTIONS() {
  return corsPreflight();
}
