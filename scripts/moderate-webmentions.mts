#!/usr/bin/env node
/**
 * List, approve, or reject incoming webmentions.
 *
 *   pnpm webmentions:moderate                  list pending mentions
 *   pnpm webmentions:moderate approve <id...>  show them on the site
 *   pnpm webmentions:moderate reject <id...>   hide them for good
 *
 * Environment variables:
 *   POSTGRES_URL - Required; point it at the production database to moderate
 *   what the live site shows
 */
import {
  MODERATION_PAST_TENSE,
  formatPendingWebmention,
  moderateWebmention,
  parseModerationCommand,
  summarizePendingWebmention,
} from '../lib/indieweb/webmention-moderation';

const USAGE = [
  'Usage:',
  '  pnpm webmentions:moderate [list]',
  '  pnpm webmentions:moderate approve <id...>',
  '  pnpm webmentions:moderate reject <id...>',
].join('\n');

const parsed = parseModerationCommand(process.argv.slice(2));
if ('error' in parsed) {
  console.error(`${parsed.error}\n\n${USAGE}`);
  process.exit(1);
}

if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
  console.error('Set POSTGRES_URL to the database that stores webmentions.');
  process.exit(1);
}

// Imported after the guards so a usage error never loads the driver.
const { sql } = await import('@vercel/postgres');
const { webmentionModerationStore: store } =
  await import('../lib/indieweb/webmention-storage');

try {
  if (parsed.command === 'list') {
    const pending = (await store.listPending()).map(summarizePendingWebmention);
    if (pending.length === 0) {
      console.log('No webmentions are waiting for moderation.');
    } else {
      console.log(`${pending.length} pending:\n`);
      console.log(pending.map(formatPendingWebmention).join('\n\n'));
    }
  } else {
    const { command: action, ids } = parsed;
    for (const id of ids) {
      if (await moderateWebmention(store, { action, id })) {
        console.log(`${MODERATION_PAST_TENSE[action]} ${id}`);
      } else {
        process.exitCode = 1;
        console.error(
          action === 'approve'
            ? `skipped ${id}: no verified, unrejected webmention has that id`
            : `skipped ${id}: no unrejected webmention has that id`
        );
      }
    }
  }
} finally {
  // The pool holds its connection open, which would keep the process alive.
  // A pool that never connected can throw here; let the original error show.
  await Promise.resolve()
    .then(() => sql.end())
    .catch(() => {});
}
