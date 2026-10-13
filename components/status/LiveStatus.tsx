import { cacheLife, cacheTag } from 'next/cache';

import { STATUS_LOCATION_TAG, readPublicStatus } from '@/lib/status/reader';

import Status from './Status';

export default async function LiveStatus({
  expanded = false,
}: {
  expanded?: boolean;
}) {
  'use cache';
  cacheLife({ stale: 300, revalidate: 900, expire: 3600 });
  cacheTag(STATUS_LOCATION_TAG);
  try {
    return <Status initial={await readPublicStatus()} expanded={expanded} />;
  } catch {
    return expanded ? (
      <p role="status">Status is unavailable right now.</p>
    ) : null;
  }
}
