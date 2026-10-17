import { spawnSync } from 'node:child_process';

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
  process.exitCode = preview.status ?? 1;
}

if (isMain(import.meta.url)) await runCloudflarePreview();
