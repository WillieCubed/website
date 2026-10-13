import { getCloudflareContext } from '@opennextjs/cloudflare';

const MEDIA_KEY =
  /^media\/\d{4}\/\d{2}\/[a-z0-9-]+\.(?:jpg|png|gif|webp|avif|heic|heif|mp3|m4a|aac|ogg|wav|webm|flac|mp4|ogv|mov|pdf)$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string[] }> }
) {
  const { key: segments } = await context.params;
  const key = `media/${segments.join('/')}`;
  if (!MEDIA_KEY.test(key)) return new Response(null, { status: 404 });
  const bucket = getCloudflareContext().env.MEDIA_BUCKET;
  if (!bucket) return new Response(null, { status: 503 });
  const object = await bucket.get(key);
  if (!object) return new Response(null, { status: 404 });
  const headers = new Headers({
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: object.httpEtag,
    'X-Content-Type-Options': 'nosniff',
  });
  headers.set(
    'Content-Type',
    object.httpMetadata?.contentType || 'application/octet-stream'
  );
  return new Response(await object.arrayBuffer(), { headers });
}
