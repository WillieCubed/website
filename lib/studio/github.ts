import { required } from './config';
import { StudioError } from './errors';

export class GitHubError extends StudioError {
  constructor(readonly githubStatus: number) {
    super(
      githubStatus === 409 || githubStatus === 422 ? 409 : 502,
      `GitHub publication failed (${githubStatus}).`
    );
  }
}

export async function github(
  path: string,
  method = 'GET',
  body?: unknown,
  authenticated = true
): Promise<Record<string, unknown>> {
  const repository = required('STUDIO_GITHUB_REPOSITORY');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository))
    throw new StudioError(503, 'Invalid publication repository.');
  const response = await fetch(
    path === '$graphql'
      ? 'https://api.github.com/graphql'
      : `https://api.github.com/repos/${repository}/${path}`,
    {
      method,
      headers: {
        ...(authenticated
          ? { Authorization: `Bearer ${required('STUDIO_GITHUB_TOKEN')}` }
          : {}),
        Accept: 'application/vnd.github+json',
        'User-Agent': 'willie-page-studio',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
      cache: 'no-store',
    }
  );
  if (!response.ok) throw new GitHubError(response.status);
  return response.json();
}
