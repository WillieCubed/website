import { cache } from 'react';

import { readPublicStatus } from '@/lib/status/reader';

import Status from './Status';

const readStatus = cache(readPublicStatus);

export default async function LiveStatus({
  expanded = false,
}: {
  expanded?: boolean;
}) {
  try {
    return <Status initial={await readStatus()} expanded={expanded} />;
  } catch {
    return expanded ? (
      <p role="status">Status is unavailable right now.</p>
    ) : null;
  }
}
