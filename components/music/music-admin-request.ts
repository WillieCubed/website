import { fetchWithDeadline } from '@/lib/http/fetch';

/** A received HTTP failure cannot be recovered as a lost import response. */
export class MusicAdminRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'MusicAdminRequestError';
  }
}

interface MusicAdminErrorBody {
  error?: string;
  details?: unknown;
}

async function readMusicAdminData<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json'))
    throw new Error(
      'The preview returned a page instead of music data. Reload the collection and try again.'
    );
  return response.json();
}

async function musicAdminHttpError(
  response: Response
): Promise<MusicAdminRequestError> {
  try {
    const data = await readMusicAdminData<MusicAdminErrorBody>(response);
    return new MusicAdminRequestError(
      data.error ?? 'The request failed. Try again.',
      response.status,
      data.details
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new MusicAdminRequestError(message, response.status);
  }
}

export async function musicAdminRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetchWithDeadline(`/api/studio/music${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!response.ok) throw await musicAdminHttpError(response);
  return readMusicAdminData<T>(response);
}
