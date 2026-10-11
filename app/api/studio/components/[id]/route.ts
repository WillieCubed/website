import { studioRoute } from '@/lib/studio/auth';
import { approveProposal } from '@/lib/studio/components';
import { StudioError } from '@/lib/studio/errors';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return studioRoute(request, async () => {
    if ((await request.json()).action !== 'approve')
      throw new StudioError(400, 'Explicit approval is required.');
    return Response.json(await approveProposal((await context.params).id));
  });
}
