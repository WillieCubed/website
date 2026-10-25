import { HttpError } from '@/lib/http/errors';
import { authorizeRefresh, refreshApproved } from '@/lib/music/refresh';

export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    authorizeRefresh(request);
    return Response.json(await refreshApproved(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof HttpError
            ? error.message
            : 'Refresh could not finish.',
      },
      {
        status: error instanceof HttpError ? error.status : 503,
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
