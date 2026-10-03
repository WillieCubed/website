import * as TID from '@atcute/tid';

import { ATPROTO_DID, DOCUMENT_COLLECTION } from './config';

/** 32-bit FNV-1a: a stable spread of paths across TID clock IDs. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (const byte of new TextEncoder().encode(input)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * A document's record key, computed rather than stored: the publish time
 * in microseconds, with a clock ID taken from the path. The page and the
 * sync both derive it, so the <link> tag ships with the build and nothing
 * maps posts to records. A new `published` time or slug gives a new key,
 * and the sync then moves the record (lib/atproto/plan.ts).
 */
export function documentRkey(path: string, published: Date): string {
  return TID.create(published.getTime() * 1000, fnv1a(path) & 1023);
}

/** A document's AT-URI, or undefined while no DID is configured. */
export function documentUri(path: string, published: Date): string | undefined {
  return ATPROTO_DID
    ? `at://${ATPROTO_DID}/${DOCUMENT_COLLECTION}/${documentRkey(path, published)}`
    : undefined;
}
