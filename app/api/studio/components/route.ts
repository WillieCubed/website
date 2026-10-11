import { studioRoute } from '@/lib/studio/auth';
import { createProposal } from '@/lib/studio/components';

export async function POST(request: Request) {
  return studioRoute(request, async () =>
    Response.json(await createProposal((await request.json()).generationId), {
      status: 201,
    })
  );
}
