import * as CID from '@atcute/cid';
import { fileTypeFromBuffer } from 'file-type';
import { imageSize } from 'image-size';

import { fetchPublicBytes } from '@/lib/indieweb/public-fetch';

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

async function validateImage(
  bytes: Uint8Array,
  mimeType: string,
  icon: boolean
): Promise<void> {
  const detected = await fileTypeFromBuffer(bytes);
  if (detected?.mime !== mimeType)
    throw new Error('Image signature does not match its MIME type.');
  const dimensions = imageSize(bytes);
  if (dimensions.width === 0 || dimensions.height === 0)
    throw new Error('Image dimensions are unavailable.');
  if (
    icon &&
    (dimensions.width !== dimensions.height || dimensions.width < 256)
  )
    throw new Error(
      'Publication icons must be square and at least 256 pixels.'
    );
}

/**
 * An image from the live site, or null when it is missing, not a raster
 * image, or over the limit. A record without a cover is still valid, so
 * a failed fetch never fails the sync.
 */
export async function fetchImageBlob(
  url: string,
  options: { icon?: boolean } = {}
): Promise<LocalBlob | null> {
  try {
    const image = await fetchPublicBytes(url, MAX_BLOB_BYTES);
    if (!image || !RASTER.test(image.mimeType)) return null;
    await validateImage(image.bytes, image.mimeType, Boolean(options.icon));
    return localBlob(image.bytes, image.mimeType);
  } catch (error) {
    console.warn(`Could not fetch ${url} for a blob:`, error);
    return null;
  }
}
