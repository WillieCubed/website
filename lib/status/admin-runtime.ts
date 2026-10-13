import { revalidateTag } from 'next/cache';

import { hasDatabase } from '@/lib/db/postgres';
import { ownerAccessAuthenticatorFromEnvironment } from '@/lib/owner/access';

import { createAdminHandler } from './admin';
import { statusStore } from './storage';

export function statusAdmin(request: Request) {
  return createAdminHandler({
    store: statusStore,
    owner: ownerAccessAuthenticatorFromEnvironment(process.env),
    configured: hasDatabase(),
    invalidate: () => revalidateTag('public-status-location', { expire: 0 }),
  })(request);
}
