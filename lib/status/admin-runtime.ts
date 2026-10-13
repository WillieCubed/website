import { hasDatabase } from '@/lib/db/postgres';
import { ownerAuthenticatorFromEnvironment } from '@/lib/indieweb/indieauth-owner';
import { ownerSignInStore } from '@/lib/indieweb/indieauth-storage';

import { createAdminHandler } from './admin';
import { statusStore } from './storage';

export function statusAdmin(request: Request) {
  return createAdminHandler({
    store: statusStore,
    owner: ownerAuthenticatorFromEnvironment(process.env, ownerSignInStore),
    configured: hasDatabase(),
    secure: process.env.NODE_ENV === 'production',
    invalidate: () => undefined,
  })(request);
}
