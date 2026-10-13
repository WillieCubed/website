import { getCloudflareContext } from '@opennextjs/cloudflare';

import { deliverMedia, mediaKey } from '@/lib/indieweb/media-delivery';

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> }
) {
  const { key: segments } = await context.params;
  if (!mediaKey(segments)) return new Response(null, { status: 404 });
  return deliverMedia(segments, getCloudflareContext().env.MEDIA_BUCKET);
}
