import type {} from '@atcute/atproto';
import { Client, ok } from '@atcute/client';
import type { Did } from '@atcute/lexicons';
import type { OAuthClient } from '@atcute/oauth-node-client';

import type { GraphRepo } from './social';
import { SocialHttpError } from './social-http';

export async function graphRepo(
  did: string,
  client: OAuthClient
): Promise<GraphRepo> {
  const session = await client.restore(did as Did).catch(() => {
    throw new SocialHttpError(
      'Your sign-in has expired. Sign out and sign in again.',
      401
    );
  });
  const rpc = new Client({ handler: session });
  return {
    async list(collection) {
      const records = [];
      let cursor: string | undefined;
      do {
        const data = await ok(
          rpc.get('com.atproto.repo.listRecords', {
            params: { repo: did as Did, collection, limit: 100, cursor },
          })
        );
        records.push(
          ...data.records.map((record) => ({
            uri: record.uri,
            value: record.value as Record<string, unknown>,
          }))
        );
        cursor = data.cursor;
      } while (cursor);
      return records;
    },
    async create(collection, value) {
      await ok(
        rpc.post('com.atproto.repo.createRecord', {
          input: {
            repo: did as Did,
            collection,
            record: value,
            validate: false,
          },
        })
      );
    },
    async remove(collection, rkey) {
      await ok(
        rpc.post('com.atproto.repo.deleteRecord', {
          input: { repo: did as Did, collection, rkey },
        })
      );
    },
  };
}
