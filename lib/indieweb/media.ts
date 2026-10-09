import { put } from '@vercel/blob';

/**
 * Where Micropub media uploads are kept.
 *
 * The media endpoint only talks to this interface, so moving uploads from
 * Vercel Blob to Cloudflare R2 means writing one more implementation and
 * returning it from {@link getMediaStore}.
 */
export interface MediaStore {
  /** Store `file` under `pathname` and return its public URL. */
  put(pathname: string, file: Blob, contentType: string): Promise<string>;
}

/** Thrown when an upload is not a photo the endpoint can keep. */
export class MediaUploadError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = 'MediaUploadError';
  }
}

/**
 * Media types the endpoint accepts, with the extension each is stored under.
 * SVG is left out because it can carry script.
 */
export const MEDIA_TYPES: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'audio/flac': 'flac',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
};

/** Public Vercel Blob storage, authorized by OIDC or a read-write token. */
export function vercelBlobMediaStore(token?: string): MediaStore {
  return {
    async put(pathname, file, contentType) {
      const blob = await put(pathname, file, {
        access: 'public',
        addRandomSuffix: true,
        contentType,
        ...(token ? { token } : {}),
      });
      return blob.url;
    },
  };
}

/** The configured store; the Blob SDK obtains the Vercel OIDC token on demand. */
export function getMediaStore(
  environment: Record<string, string | undefined> = process.env
): MediaStore | null {
  const token = environment.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) return vercelBlobMediaStore(token);
  const onVercel = environment.VERCEL === '1';
  const hasOidcToken = Boolean(environment.VERCEL_OIDC_TOKEN?.trim());
  return environment.BLOB_STORE_ID?.trim() && (onVercel || hasOidcToken)
    ? vercelBlobMediaStore()
    : null;
}

/**
 * Read the `file` part of a multipart Micropub media request, as the spec
 * names it, and check its size, media type, and byte signature.
 */
export async function parseMediaUpload(request: Request): Promise<File> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    throw new MediaUploadError('Send the upload as multipart/form-data.');
  }

  const body = await boundedUploadBody(request);
  let form: FormData;
  try {
    form = await new Response(body, {
      headers: { 'Content-Type': contentType },
    }).formData();
  } catch {
    throw new MediaUploadError('The multipart upload could not be read.');
  }
  if (form.getAll('file').length !== 1)
    throw new MediaUploadError('Upload exactly one file.');
  const file = form.get('file');
  if (!(file instanceof File)) {
    throw new MediaUploadError('The request has no "file" part.');
  }
  await validateMediaFile(file);
  return file;
}

export async function validateMediaFile(file: File): Promise<void> {
  if (file.size === 0) {
    throw new MediaUploadError('The uploaded file is empty.');
  }
  if (file.size > MAX_MEDIA_BYTES)
    throw new MediaUploadError('Uploads must be 4 MiB or smaller.', 413);
  if (!MEDIA_TYPES[file.type]) {
    throw new MediaUploadError(
      `Upload a supported image, audio, video, or PDF file (${Object.keys(MEDIA_TYPES).join(', ')}).`
    );
  }
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  if (!matchesSignature(bytes, file.type))
    throw new MediaUploadError(
      'The file signature does not match its declared media type.'
    );
}

/**
 * Where an upload is stored: `media/<year>/<month>/<name>.<ext>`. The store
 * adds a random suffix, so two uploads with the same name never collide.
 */
export function mediaPathname(file: File, now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const name =
    file.name
      .replace(/\.[^.]*$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'photo';
  return `media/${year}/${month}/${name}.${MEDIA_TYPES[file.type]}`;
}

/** Store a checked upload and return the URL a post can cite as its photo. */
export function storeMedia(
  file: File,
  store: MediaStore,
  now = new Date()
): Promise<string> {
  return store.put(mediaPathname(file, now), file, file.type);
}

export const MAX_MEDIA_BYTES = 4 * 1024 * 1024;
const MAX_UPLOAD_BODY_BYTES = MAX_MEDIA_BYTES + 64 * 1024;

async function boundedUploadBody(
  request: Request
): Promise<Uint8Array<ArrayBuffer>> {
  const size = Number(request.headers.get('content-length'));
  if (Number.isFinite(size) && size > MAX_UPLOAD_BODY_BYTES)
    throw new MediaUploadError('Uploads must be 4 MiB or smaller.', 413);
  if (!request.body) throw new MediaUploadError('The upload body is missing.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > MAX_UPLOAD_BODY_BYTES) {
        await reader.cancel();
        throw new MediaUploadError('Uploads must be 4 MiB or smaller.', 413);
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function matchesSignature(bytes: Uint8Array, mime: string): boolean {
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  const starts = (...values: number[]) =>
    values.every((value, index) => bytes[index] === value);
  const riff = ascii(0, 4) === 'RIFF';
  const iso = bytes.length >= 12 && ascii(4, 4) === 'ftyp';
  const brands = [
    ascii(8, 4),
    ...Array.from(
      { length: Math.max(0, Math.floor((bytes.length - 16) / 4)) },
      (_, index) => ascii(16 + index * 4, 4)
    ),
  ];
  switch (mime) {
    case 'image/jpeg':
      return starts(0xff, 0xd8, 0xff);
    case 'image/png':
      return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case 'image/gif':
      return ['GIF87a', 'GIF89a'].includes(ascii(0, 6));
    case 'image/webp':
      return riff && ascii(8, 4) === 'WEBP';
    case 'image/avif':
      return iso && brands.some((brand) => ['avif', 'avis'].includes(brand));
    case 'image/heic':
      return (
        iso &&
        brands.some((brand) => ['heic', 'heix', 'hevc', 'hevx'].includes(brand))
      );
    case 'image/heif':
      return (
        iso &&
        brands.some((brand) => ['mif1', 'msf1', 'heic', 'heix'].includes(brand))
      );
    case 'audio/mpeg':
      return (
        ascii(0, 3) === 'ID3' ||
        (bytes[0] === 0xff &&
          (bytes[1] & 0xe0) === 0xe0 &&
          (bytes[1] & 0x06) !== 0)
      );
    case 'audio/aac':
      return bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0;
    case 'audio/wav':
      return riff && ascii(8, 4) === 'WAVE';
    case 'audio/flac':
      return ascii(0, 4) === 'fLaC';
    case 'audio/ogg':
    case 'video/ogg':
      return ascii(0, 4) === 'OggS';
    case 'audio/webm':
    case 'video/webm':
      return starts(0x1a, 0x45, 0xdf, 0xa3);
    case 'video/quicktime':
      return iso && brands.includes('qt  ');
    case 'audio/mp4':
    case 'video/mp4':
      return (
        iso &&
        brands.some((brand) =>
          [
            'isom',
            'iso2',
            'mp41',
            'mp42',
            'M4A ',
            'M4B ',
            'M4V ',
            'avc1',
            'dash',
          ].includes(brand)
        )
      );
    case 'application/pdf':
      return ascii(0, 5) === '%PDF-';
    default:
      return false;
  }
}

export function mediaKindForType(
  mimeType: string
): 'image' | 'audio' | 'video' | 'file' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'file';
}

export function mediaMimeForUrl(
  value: string,
  kind?: 'audio' | 'video' | 'file'
): string | undefined {
  try {
    const extension = new URL(value).pathname.split('.').at(-1)?.toLowerCase();
    return Object.entries(MEDIA_TYPES).find(
      ([mime, ext]) =>
        ext === extension &&
        (!kind || kind === 'file' || mime.startsWith(`${kind}/`))
    )?.[0];
  } catch {
    return undefined;
  }
}

/** Bound file bytes before form fields or multipart parsers consume them. */
export async function readBoundedMediaRequest(
  request: Request
): Promise<Request> {
  const bytes = await boundedUploadBody(request);
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: bytes,
  });
}
