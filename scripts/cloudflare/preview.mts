import { spawnSync } from 'node:child_process';
import { constants } from 'node:os';

import { isMain } from '../shared/command.mts';
import {
  openNextPreviewArgs,
  runWithLocalWranglerConfig,
} from './local-wrangler-config.mts';

/** Runs OpenNext's local Worker preview against the generated Wrangler config. */
export async function runCloudflarePreview(args = process.argv.slice(2)) {
  const preview = await runWithLocalWranglerConfig(
    process.cwd(),
    {},
    (configPath) =>
      spawnSync('pnpm', openNextPreviewArgs(configPath, args), {
        stdio: 'inherit',
      })
  );
  if (preview.error) throw preview.error;
  // A child stopped by a signal reports the conventional 128 + signal code.
  process.exitCode =
    preview.status ??
    (preview.signal ? 128 + constants.signals[preview.signal] : 1);
}

if (isMain(import.meta.url)) await runCloudflarePreview();
