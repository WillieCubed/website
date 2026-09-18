/**
 * Post-build IndieWeb notifications.
 *
 * Runs after `next build`. It does nothing unless INDIEWEB_POSTBUILD=1, so a
 * local or preview build never pings the hub or sends webmentions, and every
 * failure is logged rather than thrown so the build still succeeds.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.INDIEWEB_POSTBUILD !== '1') {
  console.log('Skipping IndieWeb postbuild (INDIEWEB_POSTBUILD is not 1)');
  process.exit(0);
}

const here = dirname(fileURLToPath(import.meta.url));

for (const script of ['websub-ping.mts', 'send-webmentions.mts']) {
  const result = spawnSync('pnpm', ['exec', 'tsx', join(here, script)], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    console.warn(`${script} exited with ${result.status ?? 'a signal'}`);
  }
}
