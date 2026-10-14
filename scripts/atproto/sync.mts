#!/usr/bin/env node
// Dry run by default: prints what the sync would write. Pass --write to
// write it. The package command loads production settings separately from
// the development environment so local development never reads them.
// Set sensitive ATPROTO_APP_PASSWORD values directly in that environment.
import { syncAtproto } from '../../lib/atproto/sync';
import { isMain } from '../shared/command.mts';

export async function runAtprotoSync() {
  const report = await syncAtproto({
    dryRun: !process.argv.includes('--write'),
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.status === 'skipped') process.exitCode = 1;
}

if (isMain(import.meta.url)) await runAtprotoSync();
