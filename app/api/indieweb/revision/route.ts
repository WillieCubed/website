import { getCloudflareContext } from '@opennextjs/cloudflare';

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
  return Response.json(
    { sha: process.env.NEXT_PUBLIC_SITE_REVISION ?? null, runtime: runtime() },
    {
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
