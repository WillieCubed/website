import { join } from 'node:path';

import { readBinaryFile } from '@/lib/content/runtime-files';

const FONT_DIR = join(process.cwd(), 'brand', 'fonts');

/** The Atkinson faces next/og renders social images with. */
export async function loadOgFonts() {
  const [regular, bold] = await Promise.all([
    readBinaryFile(join(FONT_DIR, 'AtkinsonHyperlegibleNext-Regular.ttf')),
    readBinaryFile(join(FONT_DIR, 'AtkinsonHyperlegibleNext-Bold.ttf')),
  ]);
  return [
    {
      name: 'Atkinson',
      data: regular,
      weight: 400 as const,
      style: 'normal' as const,
    },
    {
      name: 'Atkinson',
      data: bold,
      weight: 700 as const,
      style: 'normal' as const,
    },
  ];
}
