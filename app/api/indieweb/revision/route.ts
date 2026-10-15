import { getCloudflareContext } from '@opennextjs/cloudflare';

import { siteBuild } from '@/lib/site/build';

function runtime(): 'cloudflare-workers' | 'other' {
  try {
    const { HYPERDRIVE, MEDIA_BUCKET, ASSETS } = getCloudflareContext().env;
    return HYPERDRIVE && MEDIA_BUCKET && ASSETS
      ? 'cloudflare-workers'
      : 'other';
  } catch {
    return 'other';
  }
}

export function GET() {
  const build = siteBuild();
  return Response.json(
    {
      sha: build.revision,
      runtime: runtime(),
      builtAt: build.builtAt,
      buildUrl: build.buildUrl,
    },
    {
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
