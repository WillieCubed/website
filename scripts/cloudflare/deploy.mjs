import { spawnSync } from 'node:child_process';

const target = process.argv[2] || 'production';
if (target !== 'production' && target !== 'preview') {
  throw new Error('Deploy target must be production or preview.');
}

// The Wrangler bundler that cf uses needs a local Hyperdrive URL while
// preparing the upload. The deployed Worker uses the Hyperdrive ID in
// cloudflare.config.ts instead of this placeholder.
const localHyperdriveUrl = 'postgres://unused:unused@127.0.0.1:5432/unused';
const args = ['exec', 'cf', 'deploy'];
if (target === 'preview') args.push('--mode', 'preview');
if (process.env.CLOUDFLARE_PROFILE) {
  args.push('--profile', process.env.CLOUDFLARE_PROFILE);
}

const deploy = spawnSync('pnpm', args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:
      process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ||
      localHyperdriveUrl,
  },
});
if (deploy.error) throw deploy.error;
if (deploy.status !== 0) process.exit(deploy.status ?? 1);
