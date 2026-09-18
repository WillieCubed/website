import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

import EntityImage, { type EntityImageProps } from './EntityImage';
import { loadOgFonts } from './fonts';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/**
 * Inlines a raster file from public/ as a data URI so the renderer never
 * has to fetch the site's own origin at build time. SVG placeholders are
 * skipped; the brand gradient carries the image instead.
 */
export async function publicImageDataUri(
  src?: string
): Promise<string | undefined> {
  if (!src || !src.startsWith('/')) return undefined;
  const type = MIME[extname(src).toLowerCase()];
  if (!type) return undefined;
  try {
    const data = await readFile(join(process.cwd(), 'public', src));
    return `data:${type};base64,${data.toString('base64')}`;
  } catch {
    return undefined;
  }
}

/** Renders the shared social card for an entity. */
export async function renderEntityImage(props: EntityImageProps) {
  const fonts = await loadOgFonts();
  return new ImageResponse(<EntityImage {...props} />, { ...OG_SIZE, fonts });
}
