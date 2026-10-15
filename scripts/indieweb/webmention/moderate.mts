#!/usr/bin/env node
/**
 * List, approve, or reject incoming webmentions.
 *
 *   pnpm webmentions:moderate                  list pending mentions
 *   pnpm webmentions:moderate approve <id...>  show them on the site, and
 *                                              resend each approved reply's
 *                                              post upstream (Salmention)
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
} from '../../../lib/indieweb/webmention/moderation';
import type {
  WebmentionModerationCommand,
  WebmentionModerationStore,
} from '../../../lib/indieweb/webmention/types';
import { isMain } from '../../shared/command.mts';

export async function runWebmentionModeration() {
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
  const { sql } = await import('../../../lib/db/postgres');
  const { webmentionModerationStore: store } =
    await import('../../../lib/indieweb/webmention/storage');

  try {
    if (parsed.command === 'list') {
      await listPendingMentions(store);
    } else {
      const approved = await moderateMentions(store, parsed);
      await notifyApprovedReplies(approved);
    }
  } finally {
    // The pool holds its connection open, which would keep the process alive.
    // A pool that never connected can throw here; let the original error show.
    await Promise.resolve()
      .then(() => sql.end())
      .catch(() => {});
  }
}

if (isMain(import.meta.url)) await runWebmentionModeration();

type ActionCommand = Exclude<WebmentionModerationCommand, { command: 'list' }>;
async function listPendingMentions(
  store: WebmentionModerationStore
): Promise<void> {
  const pending = (await store.listPending()).map(summarizePendingWebmention);
  if (pending.length === 0) {
    console.log('No webmentions are waiting for moderation.');
  } else {
    console.log(`${pending.length} pending:\n`);
    console.log(pending.map(formatPendingWebmention).join('\n\n'));
  }
}
async function moderateMentions(
  store: WebmentionModerationStore,
  parsed: ActionCommand
): Promise<string[]> {
  const { command: action, ids } = parsed;
  const approved: string[] = [];
  for (const id of ids) {
    if (await moderateWebmention(store, { action, id })) {
      console.log(`${MODERATION_PAST_TENSE[action]} ${id}`);
      if (action === 'approve') approved.push(id);
    } else {
      process.exitCode = 1;
      console.error(
        action === 'approve'
          ? `skipped ${id}: no verified, unrejected webmention has that id`
          : `skipped ${id}: no unrejected webmention has that id`
      );
    }
  }
  return approved;
}
async function notifyApprovedReplies(approved: string[]): Promise<void> {
  // Every approval lands before the first salmention waits for its post,
  // so replies to the same post reach upstream together in one send.
  if (approved.length > 0) {
    const { SCRIPT_SALMENTION_TIMING, defaultSalmentionDeps, sendSalmention } =
      await import('../../../lib/indieweb/salmention');
    for (const id of approved) {
      const { outcome, results } = await sendSalmention(
        id,
        defaultSalmentionDeps(),
        SCRIPT_SALMENTION_TIMING
      );
      console.log(`salmention for ${id}: ${outcome}`);
      for (const result of results) {
        console.log(
          `  ${result.success ? 'sent to' : 'failed for'} ${result.targetUrl}${result.error ? ` (${result.error})` : ''}`
        );
      }
    }
  }
}
