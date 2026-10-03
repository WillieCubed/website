import type {} from '@atcute/atproto';
import { Client, ok } from '@atcute/client';
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
  const rpc = new Client({ handler: session });

  return {
    async listRecords(collection) {
      const records = [];
      let cursor: string | undefined;
      do {
        const page = await ok(
          rpc.get('com.atproto.repo.listRecords', {
            params: { repo: did, collection, limit: 100, cursor },
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
