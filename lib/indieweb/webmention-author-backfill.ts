import type {
  WebmentionAuthorBackfillResult,
  WebmentionAuthorBackfillStore,
} from '@/lib/indieweb/types';
import { extractAuthor } from '@/lib/indieweb/webmention-verifier';

/**
 * A one-off repair for webmentions verified before the verifier read a
 * `u-photo` that carries alt text. Those rows have no author photo, though
 * the h-entry stored beside them names one. `pnpm
 * webmentions:backfill-authors` reads the photo back out with the verifier's
 * own `extractAuthor`, through a `WebmentionAuthorBackfillStore` so the logic
 * runs without a database in tests.
 */

type HEntry = Parameters<typeof extractAuthor>[0];

/**
 * Whether a stored `raw_mf2_json` is an h-entry `extractAuthor` can read. A
 * mention verified without an h-entry stores `{}`.
 */
function isHEntry(value: unknown): value is HEntry {
  if (typeof value !== 'object' || value === null) return false;
  const { properties } = value as Record<string, unknown>;
  return (
    typeof properties === 'object' &&
    properties !== null &&
    !Array.isArray(properties)
  );
}

/**
 * Give every listed mention the author photo its stored entry names. Safe to
 * run twice: the store only lists and only writes rows that have no photo.
 */
export async function backfillWebmentionAuthorPhotos(
  store: WebmentionAuthorBackfillStore
): Promise<WebmentionAuthorBackfillResult> {
  const result: WebmentionAuthorBackfillResult = { filled: [], skipped: [] };
  for (const { id, rawMf2 } of await store.listMissingPhotos()) {
    const photo = isHEntry(rawMf2) ? extractAuthor(rawMf2).photo : undefined;
    if (photo && (await store.setPhoto(id, photo))) {
      result.filled.push({ id, photo });
    } else {
      result.skipped.push(id);
    }
  }
  return result;
}

/**
 * Render a backfill result as the CLI prints it.
 */
export function formatAuthorBackfillResult({
  filled,
  skipped,
}: WebmentionAuthorBackfillResult): string {
  const lines = filled.map(({ id, photo }) => `filled ${id}  ${photo}`);
  lines.push(
    filled.length === 0
      ? 'No webmention was missing an author photo its entry names.'
      : `Filled ${filled.length} author ${filled.length === 1 ? 'photo' : 'photos'}.`
  );
  if (skipped.length > 0) {
    lines.push(
      `Left ${skipped.length} without a photo: the stored entry names none.`
    );
  }
  return lines.join('\n');
}
