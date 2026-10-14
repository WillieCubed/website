import type {} from '@atcute/atproto';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';

import type { Receipt } from './types.mts';

interface Context {
  receipt: Receipt;
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

export async function observed(
  dependencies: Context,
  collection: string,
  rkey: string
) {
  const owned = dependencies.receipt.owned.find(
    (record) => record.collection === collection && record.rkey === rkey
  );
  const versions = owned?.versions ?? dependencies.receipt.publicationVersions!;
  const record = await dependencies.get(collection, rkey);
  if (record) {
    const version = versions.find((version) =>
      isDeepStrictEqual(version.value, record.value)
    );
    assert(
      version,
      'The PDS returned a record outside the journaled write intent.'
    );
    version.cid = record.cid;
    await dependencies.save();
  }
}
