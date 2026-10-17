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

/** A GET that reports a missing resource as null rather than an error. */
export async function githubOptional(
  path: string
): Promise<Record<string, unknown> | null> {
  try {
    return await github(path);
  } catch (error) {
    if (error instanceof GitHubError && error.githubStatus === 404) return null;
    throw error;
  }
}

/**
 * The pull request from `head` into `base`, open or closed, or a new one.
 * Looking first keeps a retried publication from opening a duplicate.
 */
export async function findOrOpenPullRequest(proposal: {
  head: string;
  base: string;
  title: string;
  body: string;
}): Promise<Record<string, unknown>> {
  const owner = required('STUDIO_GITHUB_REPOSITORY').split('/')[0];
  const existing = (await github(
    `pulls?state=all&head=${encodeURIComponent(`${owner}:${proposal.head}`)}&base=${encodeURIComponent(proposal.base)}&per_page=100`
  )) as unknown as Record<string, unknown>[];
  return existing[0] ?? (await github('pulls', 'POST', proposal));
}

/**
 * Rebase-merge a pull request at exactly `sha`. Returns the merged commit, or
 * null while branch policy, reviews, or checks still hold it: those are
 * waiting states, never a reason to bypass.
 */
export async function rebaseMergePullRequest(
  number: number,
  sha: string
): Promise<string | null> {
  try {
    const result = await github(`pulls/${number}/merge`, 'PUT', {
      sha,
      merge_method: 'rebase',
    });
    return result.merged ? String(result.sha) : null;
  } catch (error) {
    if (error instanceof GitHubError && [405, 409].includes(error.githubStatus))
      return null;
    throw error;
  }
}
