import {
  DOCUMENT_COLLECTION,
  PUBLICATION_COLLECTION,
  publishingIdentity,
} from './config';
import type { DesiredRecord, ExistingRecord, LocalBlob, Write } from './types';

export interface SyncPlan {
  writes: Write[];
  /** Blobs the writes reference, each once. */
  uploads: LocalBlob[];
  unchanged: number;
}

const key = (record: { collection: string; rkey: string }) =>
  `${record.collection}/${record.rkey}`;

/** JSON with object keys sorted, so key order never reads as a change. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_, inner: unknown) =>
    inner && typeof inner === 'object' && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner).sort(([a], [b]) => a.localeCompare(b))
        )
      : inner
  );
}

/**
 * Records this site manages: its own publication, and documents that
 * name it as their site. Anything else in the repo, such as a Leaflet
 * publication and its posts, is never touched.
 */
function isOurs(record: ExistingRecord): boolean {
  const { publicationRkey, publicationUri } = publishingIdentity();
  return record.collection === PUBLICATION_COLLECTION
    ? record.rkey === publicationRkey
    : record.value.site === publicationUri;
}

/**
 * What it takes to make the repo match the content: create what is
 * missing, update what differs, and delete this site's records that no
 * writing produces any more. A document whose key changed (a new
 * `published` time or slug) is found by path and moved, and a Bluesky
 * post reference on the PDS always carries over.
 */
export function planSync(
  desired: DesiredRecord[],
  existing: ExistingRecord[]
): SyncPlan {
  const seen = new Map<string, string>();
  for (const record of desired) {
    const path = 'path' in record.value ? record.value.path : record.rkey;
    const clash = seen.get(key(record));
    if (clash) {
      throw new Error(
        `${clash} and ${path} compute the same record key ${record.rkey}.`
      );
    }
    seen.set(key(record), String(path));
  }

  const ours = existing.filter(isOurs);
  const byKey = new Map(ours.map((record) => [key(record), record]));
  const byPath = new Map(
    ours
      .filter((record) => record.collection === DOCUMENT_COLLECTION)
      .map((record) => [record.value.path, record])
  );

  const writes: Write[] = [];
  const uploads = new Map<string, LocalBlob>();
  const kept = new Set<string>();
  let unchanged = 0;

  for (const want of desired) {
    const current = byKey.get(key(want));
    const prior =
      current ??
      ('path' in want.value ? byPath.get(want.value.path) : undefined);
    const value: Record<string, unknown> = { ...want.value };
    if (value.bskyPostRef === undefined && prior?.value.bskyPostRef) {
      value.bskyPostRef = prior.value.bskyPostRef;
    }

    if (current) {
      kept.add(key(current));
      if (canonical(current.value) === canonical(value)) {
        unchanged += 1;
        continue;
      }
    }
    writes.push({
      $type: current
        ? 'com.atproto.repo.applyWrites#update'
        : 'com.atproto.repo.applyWrites#create',
      collection: want.collection,
      rkey: want.rkey,
      value,
    });
    for (const blob of want.blobs) uploads.set(blob.ref.ref.$link, blob);
  }

  for (const record of ours) {
    if (kept.has(key(record))) continue;
    writes.push({
      $type: 'com.atproto.repo.applyWrites#delete',
      collection: record.collection,
      rkey: record.rkey,
    });
  }

  return { writes, uploads: [...uploads.values()], unchanged };
}
