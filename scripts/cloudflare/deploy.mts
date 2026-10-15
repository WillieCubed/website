import { type SpawnSyncReturns, spawnSync } from 'node:child_process';

import { isMain } from '../shared/command.mts';

export async function runCloudflareDeploy() {
  const target = process.argv[2] || 'production';
  if (target !== 'production' && target !== 'preview') {
    throw new Error('Deploy target must be production or preview.');
  }

  const args = ['exec', 'cf', 'deploy'];
  if (target === 'preview') args.push('--mode', 'preview');
  if (process.env.CLOUDFLARE_PROFILE) {
    args.push('--profile', process.env.CLOUDFLARE_PROFILE);
  }

  const env = deploymentEnvironment();
  const deploy = spawnSync('pnpm', args, {
    encoding: 'utf8',
    env,
    maxBuffer: 16 * 1024 * 1024,
  });
  forwardDeploymentResult(deploy);
}

if (isMain(import.meta.url)) await runCloudflareDeploy();

function deploymentEnvironment() {
  // The Wrangler bundler that cf uses needs a local Hyperdrive URL while
  // preparing the upload. The deployed Worker uses the Hyperdrive ID in
  // the deployment configuration instead of this placeholder.
  const localHyperdriveUrl = 'postgres://unused:unused@127.0.0.1:5432/unused';
  const env = {
    ...process.env,
    CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:
      process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ||
      localHyperdriveUrl,
    CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_STUDIO_HYPERDRIVE:
      process.env
        .CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_STUDIO_HYPERDRIVE ||
      localHyperdriveUrl,
  };
  return env;
}

function forwardDeploymentResult(deploy: SpawnSyncReturns<string>) {
  if (deploy.stdout) process.stdout.write(deploy.stdout);
  if (deploy.stderr) process.stderr.write(deploy.stderr);
  if (deploy.error) throw deploy.error;

  if (deploy.status !== 0) process.exitCode = deploy.status ?? 1;
}
