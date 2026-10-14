import type { SiteBuildRecord } from '../../lib/site/build.ts';

/** Resolve only public build metadata; credentials never enter the artifact. */
export function createBuildRecord(
  env: Record<string, string | undefined>,
  fallbackRevision: string | null,
  now: Date
): SiteBuildRecord {
  const revision =
    env.NEXT_PUBLIC_SITE_REVISION ||
    env.WORKERS_CI_COMMIT_SHA ||
    env.GITHUB_SHA ||
    fallbackRevision;
  if (revision && !/^[a-f0-9]{40,64}$/i.test(revision))
    throw new Error('Invalid site revision.');
  const development = env.NODE_ENV === 'development';
  const builtAt = development ? null : env.SITE_BUILT_AT || now.toISOString();
  if (builtAt && !Number.isFinite(Date.parse(builtAt)))
    throw new Error('Invalid site build time.');
  let buildUrl: string | null = null;
  let provider: SiteBuildRecord['provider'] = null;
  if (env.WORKERS_CI === '1' && env.WORKERS_CI_BUILD_UUID) {
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        env.WORKERS_CI_BUILD_UUID
      )
    )
      throw new Error('Invalid Workers build identifier.');
    const worker =
      env.SITE_MODE === 'preview' ? 'willie-page-preview' : 'willie-page';
    buildUrl = `https://dash.cloudflare.com/18f90fa11cf0a87145be4a1517e41217/workers/services/view/${worker}/production/builds/${env.WORKERS_CI_BUILD_UUID}`;
    provider = 'cloudflare';
  } else if (
    env.GITHUB_ACTIONS === 'true' &&
    env.GITHUB_RUN_ID &&
    env.GITHUB_REPOSITORY
  ) {
    if (
      !/^\d+$/.test(env.GITHUB_RUN_ID) ||
      !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPOSITORY)
    )
      throw new Error('Invalid GitHub build identifier.');
    buildUrl = `https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`;
    provider = 'github';
  }
  return {
    revision: revision?.toLowerCase() ?? null,
    builtAt,
    buildUrl,
    provider,
    development,
  };
}
