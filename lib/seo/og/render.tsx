import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

import { site } from '@/lib/site/identity';

import EntityImage, { type EntityImageProps } from './EntityImage';
import { loadOgFonts } from './fonts';

const OG_SIZE = { width: 1200, height: 630 };

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/**
 * Inlines a public raster asset as a data URI so the renderer never
 * has to fetch the site's own origin at build time. SVG placeholders and
 * WebP files are skipped because Satori throws on them instead of ignoring
 * the image. The brand gradient carries the image in that case.
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
    try {
      const { getCloudflareContext } = await import('@opennextjs/cloudflare');
      const assets = getCloudflareContext().env.ASSETS;
      if (!assets) return undefined;
      const response = await assets.fetch(new URL(src, site.origin));
      if (!response.ok) return undefined;
      const bytes = Buffer.from(await response.arrayBuffer());
      return `data:${type};base64,${bytes.toString('base64')}`;
    } catch {
      return undefined;
    }
  }
}

/** Renders the shared social card for an entity. */
export async function renderEntityImage(props: EntityImageProps) {
  const fonts = await loadOgFonts();
  return new ImageResponse(<EntityImage {...props} />, { ...OG_SIZE, fonts });
}
