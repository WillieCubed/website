import { revalidateTag } from 'next/cache';

import { ownerAuthenticatorFromEnvironment } from '@/lib/indieweb/indieauth-owner';
import { ownerSignInStore } from '@/lib/indieweb/indieauth-storage';

import { createAdminHandler } from './admin';
import { STATUS_LOCATION_TAG } from './reader';
import { statusStore } from './storage';

export function statusAdmin(request: Request) {
  return createAdminHandler({
    store: statusStore,
    owner: ownerAuthenticatorFromEnvironment(process.env, ownerSignInStore),
    configured: !!process.env.POSTGRES_URL,
    secure: process.env.NODE_ENV === 'production',
    invalidate: () => revalidateTag(STATUS_LOCATION_TAG, { expire: 0 }),
  })(request);
}
