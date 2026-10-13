import { studioRoute } from '../studio/auth';
import { StudioError } from '../studio/errors';

export function musicRoute(request: Request, work: () => Promise<Response>) {
  return studioRoute(
    request,
    work,
    'The private Music service is unavailable.'
  );
}
export async function readMusicBody(request: Request): Promise<any> {
  const text = await request.text();
  if (text.length > 2000000)
    throw new StudioError(413, 'This collection is too large.');
  try {
    return JSON.parse(text);
  } catch {
    throw new StudioError(400, 'Invalid request.');
  }
}
