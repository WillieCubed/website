import { HttpError } from '../http/errors';
import { studioRoute } from '../studio/auth';

export function musicRoute(request: Request, work: () => Promise<Response>) {
  return studioRoute(
    request,
    work,
    'The private Music service is unavailable.'
  );
}
interface MusicRequestBody {
  revisionId: string;
  expectedRevisionId: string | null;
  catalog: unknown;
}

export async function readMusicBody(
  request: Request
): Promise<MusicRequestBody> {
  const text = await request.text();
  if (text.length > 2000000)
    throw new HttpError(413, 'This collection is too large.');
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'Invalid request.');
  }
}
