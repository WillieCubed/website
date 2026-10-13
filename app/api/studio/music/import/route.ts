import { musicRoute } from '@/lib/music/http';
import { importLibrary } from '@/lib/music/spotify/import';

export const maxDuration = 300;
export async function POST(request: Request) {
  return musicRoute(request, async () => Response.json(await importLibrary()));
}
