import type {} from '@atcute/atproto';
import { Client, ok } from '@atcute/client';
import type { Nsid } from '@atcute/lexicons';
import { PasswordSession } from '@atcute/password-session';

import { publishingIdentity } from './config';
import { resolvePds } from './identity';
import type { RepoClient } from './types';

/** The PDS's limit on operations in one applyWrites call. */
const MAX_WRITES = 200;

/**
 * A repo client signed in with the site's app password, straight at the
 * PDS the DID document names.
 */
export async function createRepoClient(password: string): Promise<RepoClient> {
  const { did } = publishingIdentity();
  const session = await PasswordSession.login({
    service: await resolvePds(did),
    identifier: did,
    password,
  });
  if (session.did !== did) {
    await session.logout();
    throw new Error('The publishing credential belongs to another account.');
  }
  const rpc = new Client({ handler: session });

  return {
    async getRecord(collection, rkey) {
      const result = await rpc.get('com.atproto.repo.getRecord', {
        params: { repo: did, collection: collection as Nsid, rkey },
      });
      if (!result.ok && result.data.error === 'RecordNotFound') return null;
      const record = ok(result);
      if (!record.cid)
        throw new Error('The PDS record has no content identifier.');
      return {
        uri: record.uri,
        cid: record.cid,
        value: record.value as Record<string, unknown>,
      };
    },
    async createRecord(collection, rkey, record) {
      return ok(
        await rpc.post('com.atproto.repo.createRecord', {
          input: { repo: did, collection: collection as Nsid, rkey, record },
        })
      );
    },
    async putRecord(collection, rkey, record, swapRecord) {
      await ok(
        rpc.post('com.atproto.repo.putRecord', {
          input: {
            repo: did,
            collection: collection as Nsid,
            rkey,
            record,
            swapRecord,
          },
        })
      );
    },
    async listRecords(collection) {
      const records = [];
      let cursor: string | undefined;
      do {
        const page = await ok(
          rpc.get('com.atproto.repo.listRecords', {
            params: {
              repo: did,
              collection: collection as Nsid,
              limit: 100,
              cursor,
            },
          })
        );
        for (const record of page.records) {
          records.push({
            collection,
            rkey: record.uri.slice(record.uri.lastIndexOf('/') + 1),
            cid: record.cid,
            value: record.value as Record<string, unknown>,
          });
        }
        cursor = page.cursor;
      } while (cursor);
      return records;
    },
    async applyWrites(writes) {
      for (let start = 0; start < writes.length; start += MAX_WRITES) {
        await ok(
          rpc.post('com.atproto.repo.applyWrites', {
            input: {
              repo: did,
              writes: writes.slice(start, start + MAX_WRITES),
            },
          })
        );
      }
    },
    async uploadBlob({ bytes, ref }) {
      await ok(
        rpc.post('com.atproto.repo.uploadBlob', {
          input: bytes,
          headers: { 'content-type': ref.mimeType },
        })
      );
    },
    close: () => session.logout(),
  };
}
