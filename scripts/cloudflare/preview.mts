import { spawnSync } from 'node:child_process';

import { isMain } from '../shared/command.mts';
import {
  openNextPreviewArgs,
  writeLocalWranglerConfig,
} from './local-wrangler-config.mts';

/** Runs OpenNext's local Worker preview against the generated Wrangler config. */
export async function runCloudflarePreview(args = process.argv.slice(2)) {
  const config = await writeLocalWranglerConfig(process.cwd());
  try {
    const preview = spawnSync('pnpm', openNextPreviewArgs(config.path, args), {
      stdio: 'inherit',
    });
    if (preview.error) throw preview.error;
    process.exitCode = preview.status ?? 1;
  } finally {
    await config.remove();
  }
}

if (isMain(import.meta.url)) await runCloudflarePreview();
