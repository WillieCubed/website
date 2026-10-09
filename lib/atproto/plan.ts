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
 * Fields a desired record may lack that the PDS copy has, which then
 * carry over rather than being stripped. `bskyPostRef` is added by a
 * later step, not by the content. `icon` and `coverImage` come from a
 * fetched image: every writing has an image source, so a missing one
 * means the fetch failed, and a failed fetch must not unpublish a blob.
 */
const CARRIED_FIELDS = [
  'bskyPostRef',
  'coverImage',
  'icon',
  'content',
  'links',
  'contributors',
  'labels',
  'preferences',
] as const;

/**
 * What it takes to make the repo match the content: create what is
 * missing, update what differs, and delete this site's records that no
 * writing produces any more. A document whose key changed only because
 * its publish time did is found by path and moved; a slug change changes
 * the path too, so the old record is deleted and its Bluesky post
 * reference goes with it. Fields in `CARRIED_FIELDS` carry over from the
 * PDS copy when the desired record lacks them.
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
    const known = new Set([
      '$type',
      'url',
      'name',
      'description',
      'basicTheme',
      'preferences',
      'site',
      'path',
      'title',
      'publishedAt',
      'updatedAt',
      'tags',
      'textContent',
      ...CARRIED_FIELDS,
    ]);
    const extensions = Object.fromEntries(
      Object.entries(prior?.value ?? {}).filter(([field]) => !known.has(field))
    );
    const value: Record<string, unknown> = { ...extensions, ...want.value };
    for (const field of CARRIED_FIELDS) {
      if (
        value[field] === undefined &&
        prior?.value[field] &&
        !want.removeFields?.includes(field)
      ) {
        value[field] = prior.value[field];
      }
    }
    for (const field of want.removeFields ?? []) delete value[field];

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
