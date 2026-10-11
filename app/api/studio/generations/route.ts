import { after } from 'next/server';

import { studioRoute } from '@/lib/studio/auth';
import { dispatchGeneration, queueGeneration } from '@/lib/studio/lattice';

export const maxDuration = 180;
export async function POST(request: Request) {
  return studioRoute(request, async () => {
    const generation = await queueGeneration(await request.json());
    after(async () => {
      await dispatchGeneration(generation);
    });
    return Response.json(generation, { status: 202 });
  });
}
