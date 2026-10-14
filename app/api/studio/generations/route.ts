import { studioRoute } from '@/lib/studio/auth';
import { createGeneration } from '@/lib/studio/lattice';

export const maxDuration = 180;
export async function POST(request: Request) {
  return studioRoute(request, async () => {
    const generation = await createGeneration(await request.json());
    return Response.json(generation);
  });
}
