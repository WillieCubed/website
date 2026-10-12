import { revalidateTag } from 'next/cache';

import { ownerAuthenticatorFromEnvironment } from '@/lib/indieweb/indieauth-owner';
import { ownerSignInStore } from '@/lib/indieweb/indieauth-storage';
import { createAdminHandler } from '@/lib/status/admin';
import { STATUS_LOCATION_TAG } from '@/lib/status/reader';
import { statusStore } from '@/lib/status/storage';

function handle(request: Request) {
  return createAdminHandler({
    store: statusStore,
    owner: ownerAuthenticatorFromEnvironment(process.env, ownerSignInStore),
    configured: !!process.env.POSTGRES_URL,
    secure: process.env.NODE_ENV === 'production',
    invalidate: () => revalidateTag(STATUS_LOCATION_TAG, { expire: 0 }),
  })(request);
}
export const GET = handle;
export const POST = handle;
