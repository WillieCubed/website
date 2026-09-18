import { INDIEAUTH_TOKEN_ENDPOINT, SITE_URL } from '@/lib/indieweb/constants';
import type {
  IndieAuthTokenResponse,
  IndieAuthVerificationOptions,
} from '@/lib/indieweb/types';
import { sameOrigin } from '@/lib/indieweb/utils';

export async function verifyIndieAuthToken({
  bearer,
  endpoint = INDIEAUTH_TOKEN_ENDPOINT,
  expectedMe = SITE_URL,
  requiredScope,
}: IndieAuthVerificationOptions): Promise<boolean> {
  const response = await fetch(endpoint, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${bearer}`,
    },
  });

  if (!response.ok) return false;

  const data = (await response
    .json()
    .catch(() => null)) as IndieAuthTokenResponse | null;

  if (!data?.me || !sameOrigin(data.me, expectedMe)) return false;
  if (!requiredScope) return true;

  return (data.scope ?? '').split(/\s+/).includes(requiredScope);
}
