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

const env = {
  ...process.env,
  CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE:
    process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ||
    localHyperdriveUrl,
};
const deploy = spawnSync('pnpm', args, {
  encoding: 'utf8',
  env,
  maxBuffer: 16 * 1024 * 1024,
});
if (deploy.stdout) process.stdout.write(deploy.stdout);
if (deploy.stderr) process.stderr.write(deploy.stderr);
if (deploy.error) throw deploy.error;

// cf's current upload path can fail while Cloudflare validates an existing
// Hyperdrive binding. Its strict configuration comparison can also reject the
// existing dashboard metadata even when Wrangler accepts the checked-in config.
// Use the checked-in equivalent Wrangler config for either known failure.
if (deploy.status !== 0) {
  const output = `${deploy.stdout ?? ''}\n${deploy.stderr ?? ''}`;
  const hyperdriveUnavailable =
    output.includes('binding HYPERDRIVE') &&
    output.includes('sqc-config failed with status code 503');
  const strictConfigurationConflict =
    output.includes('local configuration being used') &&
    output.includes('Aborting the upload operation because of conflicts');
  if (!hyperdriveUnavailable && !strictConfigurationConflict) {
    process.exitCode = deploy.status ?? 1;
  } else {
    console.warn(
      hyperdriveUnavailable
        ? 'cf Hyperdrive validation returned 503; deploying with Wrangler.'
        : 'cf rejected existing remote configuration metadata; deploying the checked-in Wrangler configuration.'
    );
    const fallback = spawnSync(
      'pnpm',
      [
        'exec',
        'wrangler',
        'deploy',
        '--config',
        target === 'preview' ? 'wrangler.preview.jsonc' : 'wrangler.jsonc',
      ],
      { stdio: 'inherit', env }
    );
    if (fallback.error) throw fallback.error;
    if (fallback.status !== 0) process.exitCode = fallback.status ?? 1;
  }
}
