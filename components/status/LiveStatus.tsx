import { defaultLocation, publicLocation } from '@/lib/status/location';
import { readPublicStatus } from '@/lib/status/reader';

import Status from './Status';

interface LiveStatusProps {
  expanded?: boolean;
}

export default async function LiveStatus({
  expanded = false,
}: LiveStatusProps) {
  try {
    return <Status initial={await readPublicStatus()} expanded={expanded} />;
  } catch {
    return (
      <Status
        initial={{
          location: publicLocation(defaultLocation),
          weather: null,
          unavailable: true,
        }}
        expanded={expanded}
      />
    );
  }
}
