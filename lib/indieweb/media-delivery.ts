import { type ByteRange, acceptsRange, byteRange } from '@/lib/http/range';
import { matchesEntityTag } from '@/lib/http/validators';

interface MediaObject {
  httpEtag: string;
  etag: string;
  size: number;
  uploaded: Date;
  httpMetadata?: { contentType?: string };
}
interface MediaBody extends MediaObject {
  body: ReadableStream<Uint8Array>;
}
export interface MediaBucket {
  head(key: string): Promise<MediaObject | null>;
  get(
    key: string,
    options?: {
      range?: ByteRange;
      onlyIf?: { etagMatches: string };
    }
  ): Promise<MediaBody | MediaObject | null>;
}

const MEDIA_KEY =
  /^media\/(?:\d{4}\/(?:0[1-9]|1[0-2])\/[a-z0-9-]+|writings\/[a-f0-9-]{36}\/[a-f0-9-]{36})\.(?:jpg|png|gif|webp|avif|heic|heif|mp3|m4a|aac|ogg|wav|webm|flac|mp4|ogv|mov|pdf)$/;

export function mediaKey(segments: string[]): string | null {
  const key = `media/${segments.join('/')}`;
  return MEDIA_KEY.test(key) ? key : null;
}

function mediaHeaders(object: MediaObject): Headers {
  return new Headers({
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: object.httpEtag,
    'Last-Modified': object.uploaded.toUTCString(),
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
    'Content-Type':
      object.httpMetadata?.contentType || 'application/octet-stream',
  });
}

/** Validate representation metadata before reading or streaming any object bytes. */
export async function deliverMedia(
  segments: string[],
  bucket: MediaBucket | undefined,
  request = new Request('https://willie.page/media/')
): Promise<Response> {
  const key = mediaKey(segments);
  if (!key) return new Response(null, { status: 404 });
  if (!bucket) return new Response(null, { status: 503 });
  const object = await bucket.head(key);
  if (!object) return new Response(null, { status: 404 });
  const headers = mediaHeaders(object);
  if (matchesEntityTag(request.headers.get('If-None-Match'), object.httpEtag))
    return new Response(null, { status: 304, headers });
  if (request.method === 'HEAD') {
    headers.set('Content-Length', String(object.size));
    return new Response(null, { headers });
  }
  return streamMedia(key, object, bucket, request, headers);
}

async function streamMedia(
  key: string,
  object: MediaObject,
  bucket: MediaBucket,
  request: Request,
  headers: Headers
): Promise<Response> {
  const range = acceptsRange(
    request.headers.get('If-Range'),
    object.httpEtag,
    object.uploaded
  )
    ? byteRange(request.headers.get('Range'), object.size)
    : undefined;
  if (range === null) {
    headers.set('Content-Range', `bytes */${object.size}`);
    return new Response(null, { status: 416, headers });
  }
  const result = await bucket.get(key, {
    range,
    onlyIf: { etagMatches: object.etag },
  });
  if (!result) return new Response(null, { status: 404 });
  // A replacement between the metadata read and stream must not use stale lengths.
  if (!('body' in result) || result.body === undefined)
    return new Response(null, { status: 412 });
  headers.set('Content-Length', String(range?.length ?? object.size));
  if (range)
    headers.set(
      'Content-Range',
      `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`
    );
  return new Response(result.body, { status: range ? 206 : 200, headers });
}
