import { spawnSync } from 'node:child_process';

const target = process.argv[2] || 'production';
if (target !== 'production' && target !== 'preview') {
  throw new Error('Deploy target must be production or preview.');
}

// OpenNext initializes Wrangler's local platform proxy while preparing a
// remote deploy. That proxy requires a local Hyperdrive URL even though the
// deployed Worker uses the Hyperdrive ID in its Wrangler configuration.
const localHyperdriveUrl = 'postgres://unused:unused@127.0.0.1:5432/unused';
const args = ['exec', 'wrangler', 'deploy'];
if (target === 'preview') args.push('--config', 'wrangler.preview.jsonc');

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
