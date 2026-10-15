import type {} from '@atcute/atproto';
import type {} from '@atcute/bluesky';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

import type { RepoClient, RepoRecord } from '../../../../../lib/atproto/types';
import type { Owned, Receipt } from './types.mts';

interface Context {
  receipt: Receipt | undefined;
  remove: (entry: Owned) => Promise<void>;
  get: (collection: string, rkey: string) => Promise<RepoRecord | null>;
  config: typeof import('../../../../../lib/atproto/config');
  client: RepoClient;
  save: () => Promise<void>;
  deploy: () => Promise<void>;
  did: string | undefined;
}

export async function cleanup(dependencies: Readonly<Context>) {
  assert(dependencies.receipt);
  for (const entry of [...dependencies.receipt.owned].reverse())
    await dependencies.remove(entry);
  await restoreDocument(dependencies, dependencies.receipt);
  await restoreSource(dependencies, dependencies.receipt);
  const documents = await dependencies.client.listRecords(
    dependencies.config.DOCUMENT_COLLECTION
  );
  for (const foreign of dependencies.receipt.foreignDocuments)
    assert(
      documents.some(
        (item) => item.rkey === foreign.rkey && item.cid === foreign.cid
      ),
      'A foreign document changed.'
    );
  const { createPool } = await import('../../../../../lib/db/postgres');
  const db = createPool({ max: 1 });
  try {
    for (const entry of dependencies.receipt.owned.filter(
      (entry) => entry.collection === 'app.bsky.feed.post'
    ))
      await db.sql`DELETE FROM atproto_response_observations WHERE copy_uri = ${`at://${dependencies.did}/app.bsky.feed.post/${entry.rkey}`}`;
  } finally {
    await db.end();
  }
  dependencies.receipt.cleanup = 'passed';
  await dependencies.save();
}

async function restoreDocument(
  dependencies: Readonly<Context>,
  receipt: Receipt
) {
  const current = await dependencies.get(
    dependencies.config.DOCUMENT_COLLECTION,
    receipt.document.rkey
  );
  assert(current, 'Do not recreate a fixture deleted by someone else.');
  if (!isDeepStrictEqual(current.value, receipt.document.original.value)) {
    assert(
      receipt.document.expected &&
        isDeepStrictEqual(current.value, receipt.document.expected),
      'The fixture document changed outside this runner.'
    );
    await dependencies.client.putRecord!(
      dependencies.config.DOCUMENT_COLLECTION,
      receipt.document.rkey,
      receipt.document.original.value,
      current.cid
    );
  }
  assert(
    isDeepStrictEqual(
      (
        await dependencies.get(
          dependencies.config.DOCUMENT_COLLECTION,
          receipt.document.rkey
        )
      )?.value,
      receipt.document.original.value
    )
  );
  assert(
    (
      await dependencies.get(
        dependencies.config.DOCUMENT_COLLECTION,
        receipt.document.rkey
      )
    )?.cid === receipt.document.original.cid
  );
  receipt.document.restored = true;
  await dependencies.save();
}

async function restoreSource(
  dependencies: Readonly<Context>,
  receipt: Receipt
) {
  const original = receipt.source.original,
    temporary = receipt.source.temporary;
  const source = await readFile(receipt.source.path, 'utf8');
  assert(
    source === original ||
      source === temporary ||
      !!receipt.source.versions?.includes(source),
    'The fixture source changed outside this runner.'
  );
  if (source !== original) await writeFile(receipt.source.path, original);
  if (temporary && !receipt.source.deployed) {
    await dependencies.deploy();
    receipt.source.deployed = true;
    await dependencies.save();
  }
  receipt.source.restored = true;
  await dependencies.save();
}
