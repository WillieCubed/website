import { execFileSync, spawnSync } from 'node:child_process';

import { isMain } from '../shared/command.mts';
import { runWithLocalWranglerConfig } from './local-wrangler-config.mts';

export async function runCloudflareBuild() {
  const target = process.argv[2] || 'production';
  if (target !== 'production' && target !== 'preview') {
    throw new Error('Build target must be production or preview.');
  }
  const origin =
    target === 'preview'
      ? 'https://preview.willie.page'
      : 'https://willie.page';
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const build = await runWithLocalWranglerConfig(
    process.cwd(),
    {
      mode: target === 'preview' ? 'preview' : undefined,
      skipUntranslated: true,
    },
    (configPath) =>
      spawnSync(
        'pnpm',
        ['exec', 'opennextjs-cloudflare', 'build', '--config', configPath],
        {
          stdio: 'inherit',
          env: {
            ...process.env,
            NEXT_PUBLIC_SITE_REVISION: revision,
            NEXT_PUBLIC_SITE_ORIGIN: origin,
            SITE_MODE: target,
            NEXT_PUBLIC_ATPROTO_DID: 'did:plc:iyn6nc3ffqm2e3555exyrgvv',
            NEXT_PUBLIC_BLUESKY_HANDLE: 'williecubed.me',
          },
        }
      )
  );
  if (build.error) throw build.error;
  if (build.status !== 0) process.exit(build.status ?? 1);
  execFileSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/cloudflare/package-runtime.mts'],
    {
      stdio: 'inherit',
    }
  );
}

if (isMain(import.meta.url)) await runCloudflareBuild();
