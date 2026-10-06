import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import sharp from 'sharp';

import { getMediaMentions } from '../lib/media';

export async function validateMediaImage(bytes: Buffer, src: string) {
  // Full decoding catches truncated files that still have a valid header.
  // A 40-megapixel cap bounds decoder memory during authoring and builds.
  const image = sharp(bytes, { limitInputPixels: 40_000_000 });
  try {
    const { format, compression } = await image.metadata();
    const extension = extname(src).slice(1).replace('jpg', 'jpeg');
    if (
      format !== extension &&
      !(format === 'heif' && compression === 'av1' && extension === 'avif')
    ) {
      throw new Error('The image format does not match its filename.');
    }
    await image.stats();
  } catch (cause) {
    throw new Error(`${src}: invalid or undecodable image.`, { cause });
  }
}

export async function checkMediaAssets(root = process.cwd()) {
  const mentions = getMediaMentions({
    directory: join(root, 'content/media'),
    includeDrafts: true,
  });
  for (const { id, image } of mentions) {
    if (!image) continue;
    try {
      await validateMediaImage(
        await readFile(join(root, 'public', image.src)),
        image.src
      );
    } catch (cause) {
      throw new Error(`${id}: cached media image is missing or invalid.`, {
        cause,
      });
    }
  }
}
