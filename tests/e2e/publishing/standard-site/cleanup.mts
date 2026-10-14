import type {} from '@atcute/atproto';
import { Client, ok } from '@atcute/client';
import type { Did, Nsid } from '@atcute/lexicons';
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
  rpc: () => Promise<
    Client<
      import('@atcute/lexicons/ambient').XRPCQueries,
      import('@atcute/lexicons/ambient').XRPCProcedures
    >
  >;
  did: string | undefined;
  PUBLICATION_COLLECTION: string;
  publicationRkey: string;
  rawClient: import('../../../../lib/atproto/types').RepoClient;
  save: () => Promise<void>;
}

export async function cleanup(dependencies: Context) {
  // The journal lists only keys reserved by this run. Never delete every
  // record in a collection or remove a pre-existing publication.
  for (const record of [...dependencies.receipt.owned].reverse()) {
    const current = await dependencies.get(record.collection, record.rkey);
    if (current) {
      assert(
        record.versions?.some(
          (version) =>
            isDeepStrictEqual(version.value, current.value) &&
            (!version.cid || version.cid === current.cid)
        ),
        'Refuse cleanup of a changed or unjournaled record.'
      );
      await ok(
        (await dependencies.rpc()).post('com.atproto.repo.deleteRecord', {
          input: {
            repo: dependencies.did as Did,
            collection: record.collection as Nsid,
            rkey: record.rkey,
            swapRecord: current.cid,
          },
        })
      );
    }
  }
  const current = await dependencies.get(
    dependencies.PUBLICATION_COLLECTION,
    dependencies.publicationRkey
  );
  if (dependencies.receipt.originalPublication && current) {
    assert(
      dependencies.receipt.publicationVersions?.some(
        (version) =>
          isDeepStrictEqual(version.value, current.value) &&
          (!version.cid || version.cid === current.cid)
      ),
      'Refuse restoration over a changed publication.'
    );
    await dependencies.rawClient.putRecord!(
      dependencies.PUBLICATION_COLLECTION,
      dependencies.publicationRkey,
      dependencies.receipt.originalPublication,
      current.cid
    );
  }
  for (const record of dependencies.receipt.owned)
    assert.equal(
      await dependencies.get(record.collection, record.rkey),
      null,
      'Acceptance record cleanup failed.'
    );
  if (dependencies.receipt.originalPublication)
    assert.deepEqual(
      (
        await dependencies.get(
          dependencies.PUBLICATION_COLLECTION,
          dependencies.publicationRkey
        )
      )?.value,
      dependencies.receipt.originalPublication
    );
  dependencies.receipt.cleanup = 'passed';
  await dependencies.save();
}
