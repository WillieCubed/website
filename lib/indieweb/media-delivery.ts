interface MediaObject {
  httpEtag: string;
  httpMetadata?: { contentType?: string };
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface MediaBucket {
  get(key: string): Promise<MediaObject | null>;
}

const MEDIA_KEY =
  /^media\/(?:\d{4}\/(?:0[1-9]|1[0-2])\/[a-z0-9-]+|writings\/[a-f0-9-]{36}\/[a-f0-9-]{36})\.(?:jpg|png|gif|webp|avif|heic|heif|mp3|m4a|aac|ogg|wav|webm|flac|mp4|ogv|mov|pdf)$/;

export function mediaKey(segments: string[]): string | null {
  const key = `media/${segments.join('/')}`;
  return MEDIA_KEY.test(key) ? key : null;
}

export async function deliverMedia(
  segments: string[],
  bucket: MediaBucket | undefined
): Promise<Response> {
  const key = mediaKey(segments);
  if (!key) return new Response(null, { status: 404 });
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
