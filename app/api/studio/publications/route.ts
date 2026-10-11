import { studioRoute } from '@/lib/studio/auth';
import { publishRevision } from '@/lib/studio/publication';

export async function POST(request: Request) {
  return studioRoute(request, async () => {
    const body = await request.json();
    return Response.json(
      await publishRevision(body.documentId, body.revisionId),
      { status: 202 }
    );
  });
}
