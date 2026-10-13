#!/usr/bin/env node
// Dry run by default: prints what the sync would write. Pass --write to
// write it. Reads .env.atproto.local, which holds production values only and
// is kept apart from .env.local so `next dev` never loads them. Add the
// production app password directly to that ignored file when a local write
// is required; Cloudflare does not expose stored secret values.
import { syncAtproto } from '../lib/atproto/sync';

const report = await syncAtproto({ dryRun: !process.argv.includes('--write') });
console.log(JSON.stringify(report, null, 2));
if (report.status === 'skipped') process.exitCode = 1;
