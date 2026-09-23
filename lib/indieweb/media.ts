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
  constructor(message: string) {
    super(message);
    this.name = 'MediaUploadError';
  }
}

/**
 * Photo types the endpoint accepts, with the extension each is stored under.
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
};

/** Public Vercel Blob storage, authorized by a read-write token. */
export function vercelBlobMediaStore(token: string): MediaStore {
  return {
    async put(pathname, file, contentType) {
      const blob = await put(pathname, file, {
        access: 'public',
        addRandomSuffix: true,
        contentType,
        token,
      });
      return blob.url;
    },
  };
}

/** The configured store, or null when `BLOB_READ_WRITE_TOKEN` is unset. */
export function getMediaStore(
  environment: Record<string, string | undefined> = process.env
): MediaStore | null {
  const token = environment.BLOB_READ_WRITE_TOKEN?.trim();
  return token ? vercelBlobMediaStore(token) : null;
}

/**
 * Read the `file` part of a multipart Micropub media request, as the spec
 * names it, and check that it is a photo.
 */
export async function parseMediaUpload(request: Request): Promise<File> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    throw new MediaUploadError('Send the upload as multipart/form-data.');
  }

  const file = (await request.formData()).get('file');
  if (!(file instanceof File)) {
    throw new MediaUploadError('The request has no "file" part.');
  }
  if (file.size === 0) {
    throw new MediaUploadError('The uploaded file is empty.');
  }
  if (!MEDIA_TYPES[file.type]) {
    throw new MediaUploadError(
      `Only photos can be uploaded (${Object.keys(MEDIA_TYPES).join(', ')}).`
    );
  }
  return file;
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
