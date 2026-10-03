import * as CID from '@atcute/cid';

import type { LocalBlob } from './types';

/** The lexicons' limit for icons and covers, and Bluesky's for thumbs. */
export const MAX_BLOB_BYTES = 1_000_000;
const RASTER = /^image\/(png|jpeg|webp|gif)$/;

/**
 * The blob reference a record carries for these bytes, computed locally:
 * a raw-codec CID, the same one the PDS returns on upload. Comparing
 * references lets the sync skip uploads for unchanged records.
 */
export async function localBlob(
  bytes: Uint8Array,
  mimeType: string
): Promise<LocalBlob> {
  const cid = await CID.create(0x55, bytes);
  return {
    bytes,
    ref: {
      $type: 'blob',
      ref: { $link: CID.toString(cid) },
      mimeType,
      size: bytes.byteLength,
    },
  };
}

/**
 * An image from the live site, or null when it is missing, not a raster
 * image, or over the limit. A record without a cover is still valid, so
 * a failed fetch never fails the sync.
 */
export async function fetchImageBlob(url: string): Promise<LocalBlob | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'image/png,image/jpeg,image/webp,image/gif' },
      // A hung image must not stall the sync; the abort lands in the catch.
      signal: AbortSignal.timeout(10_000),
    });
    const mimeType =
      response.headers.get('content-type')?.split(';')[0].trim() ?? '';
    if (!response.ok || !RASTER.test(mimeType)) return null;
    const declared = Number(response.headers.get('content-length'));
    if (declared > MAX_BLOB_BYTES) {
      console.warn(`${url} is ${declared} bytes; skipping its blob.`);
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BLOB_BYTES) {
      console.warn(`${url} is ${bytes.byteLength} bytes; skipping its blob.`);
      return null;
    }
    return localBlob(bytes, mimeType);
  } catch (error) {
    console.warn(`Could not fetch ${url} for a blob:`, error);
    return null;
  }
}
