import { getPaletteData } from '@/lib/search/palette/data';

/**
 * Return titles, URLs, and supporting text for writings, initiatives, and
 * ventures in the command palette. Include the latest writing and current
 * initiative part. Use the same draft visibility as the site's pages.
 */
export async function GET() {
  return Response.json(await getPaletteData());
}
