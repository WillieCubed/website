#!/usr/bin/env node
// Dry run by default: prints what the sync would write. Pass --write to
// write it. Needs ATPROTO_APP_PASSWORD (vercel env pull .env.local
// --environment=production).
import { syncAtproto } from '../lib/atproto/sync';

const report = await syncAtproto({ dryRun: !process.argv.includes('--write') });
console.log(JSON.stringify(report, null, 2));
if (report.status === 'skipped') process.exitCode = 1;
