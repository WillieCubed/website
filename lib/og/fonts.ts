import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FONT_DIR = join(process.cwd(), 'brand', 'fonts');

/** The Atkinson faces next/og renders social images with. */
export async function loadOgFonts() {
  const [regular, bold] = await Promise.all([
    readFile(join(FONT_DIR, 'AtkinsonHyperlegibleNext-Regular.ttf')),
    readFile(join(FONT_DIR, 'AtkinsonHyperlegibleNext-Bold.ttf')),
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
