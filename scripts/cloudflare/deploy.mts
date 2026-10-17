import { type SpawnSyncReturns, spawnSync } from 'node:child_process';

import { isMain } from '../shared/command.mts';
import { localHyperdriveEnvironment } from './local-wrangler-config.mts';

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

  const env = await deploymentEnvironment(target);
  const deploy = spawnSync('pnpm', args, {
    encoding: 'utf8',
    env,
    maxBuffer: 16 * 1024 * 1024,
  });
  forwardDeploymentResult(deploy);
}

if (isMain(import.meta.url)) await runCloudflareDeploy();

// The Wrangler bundler that cf uses needs a local Hyperdrive URL while
// preparing the upload. The deployed Worker uses the Hyperdrive ID in the
// deployment configuration instead of this placeholder.
async function deploymentEnvironment(target: string) {
  return {
    ...process.env,
    ...(await localHyperdriveEnvironment(
      target === 'preview' ? 'preview' : undefined
    )),
  };
}

function forwardDeploymentResult(deploy: SpawnSyncReturns<string>) {
  if (deploy.stdout) process.stdout.write(deploy.stdout);
  if (deploy.stderr) process.stderr.write(deploy.stderr);
  if (deploy.error) throw deploy.error;

  if (deploy.status !== 0) process.exitCode = deploy.status ?? 1;
}
