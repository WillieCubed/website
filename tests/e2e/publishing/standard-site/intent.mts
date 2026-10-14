import type {} from '@atcute/atproto';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';

import type { Receipt } from './types.mts';

interface Context {
  receipt: Receipt;
  PUBLICATION_COLLECTION: string;
  publicationRkey: string;
  get: (
    collection: string,
    rkey: string
  ) => Promise<{
    uri: string;
    cid: string;
    value: Record<string, unknown>;
  } | null>;
  save: () => Promise<void>;
}

export async function intent(
  dependencies: Context,
  collection: string,
  rkey: string,
  value?: Record<string, unknown>
) {
  const owned = dependencies.receipt.owned.find(
    (record) => record.collection === collection && record.rkey === rkey
  );
  const versions = owned
    ? (owned.versions ??= [])
    : collection === dependencies.PUBLICATION_COLLECTION &&
        rkey === dependencies.publicationRkey
      ? (dependencies.receipt.publicationVersions ??= [])
      : undefined;
  assert(
    versions,
    'The synchronization attempted to mutate an unreserved record.'
  );
  const current = await dependencies.get(collection, rkey);
  assert(
    !current ||
      versions.some(
        (version) =>
          isDeepStrictEqual(version.value, current.value) &&
          (!version.cid || version.cid === current.cid)
      ),
    'The reserved record changed outside this acceptance run.'
  );
  if (
    value &&
    !versions.some((version) => isDeepStrictEqual(version.value, value))
  )
    versions.push({ value });
  await dependencies.save();
}
