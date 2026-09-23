#!/usr/bin/env node
/**
 * Fill in author photos for webmentions verified before the verifier read a
 * `u-photo` with alt text. Each photo comes from the h-entry already stored
 * with the mention; nothing is fetched. Safe to run more than once.
 *
 *   pnpm webmentions:backfill-authors
 *
 * Environment variables:
 *   POSTGRES_URL - The database that stores webmentions. Without it the
 *   script has nothing to repair and exits without doing anything.
 */
if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
  console.log(
    'No database configured: set POSTGRES_URL to backfill webmention author photos. Nothing changed.'
  );
  process.exit(0);
}

// Imported after the guard so a run without a database never loads the driver.
const { sql } = await import('@vercel/postgres');
const { webmentionAuthorBackfillStore: store } =
  await import('../lib/indieweb/webmention-storage');
const { backfillWebmentionAuthorPhotos, formatAuthorBackfillResult } =
  await import('../lib/indieweb/webmention-author-backfill');

try {
  console.log(
    formatAuthorBackfillResult(await backfillWebmentionAuthorPhotos(store))
  );
} finally {
  // The pool holds its connection open, which would keep the process alive.
  // A pool that never connected can throw here; let the original error show.
  await Promise.resolve()
    .then(() => sql.end())
    .catch(() => {});
}
