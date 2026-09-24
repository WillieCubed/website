import { getPaletteData } from '@/lib/palette/data';

/**
 * GET /api/palette
 *
 * The places the command palette offers (lib/palette/data.ts): the latest
 * writing and initiative part, every writing, initiative, and venture. The
 * palette asks for them when it first opens, so no page carries the whole
 * list in its own payload.
 */
export async function GET() {
  return Response.json(await getPaletteData());
}
