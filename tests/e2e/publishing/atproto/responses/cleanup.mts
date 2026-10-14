import type {} from '@atcute/atproto';
import type {} from '@atcute/bluesky';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';

import type { Owned, Receipt } from './types.mts';

interface Context {
  receipt: Receipt | undefined;
  remove: (entry: Owned) => Promise<void>;
  get: (
    collection: string,
    rkey: string
  ) => Promise<{
    uri: string;
    cid: string;
    value: Record<string, unknown>;
  } | null>;
  config: typeof import('../../../../../lib/atproto/config');
  client: import('../../../../../lib/atproto/types.ts').RepoClient;
  save: () => Promise<void>;
  deploy: () => Promise<void>;
  did: string | undefined;
}

export async function cleanup(dependencies: Context) {
  assert(dependencies.receipt);
  for (const entry of [...dependencies.receipt.owned].reverse())
    await dependencies.remove(entry);
  const current = await dependencies.get(
    dependencies.config.DOCUMENT_COLLECTION,
    dependencies.receipt.document.rkey
  );
  assert(current, 'Do not recreate a fixture deleted by someone else.');
  if (
    !isDeepStrictEqual(
      current.value,
      dependencies.receipt.document.original.value
    )
  ) {
    assert(
      dependencies.receipt.document.expected &&
        isDeepStrictEqual(
          current.value,
          dependencies.receipt.document.expected
        ),
      'The fixture document changed outside this runner.'
    );
    await dependencies.client.putRecord!(
      dependencies.config.DOCUMENT_COLLECTION,
      dependencies.receipt.document.rkey,
      dependencies.receipt.document.original.value,
      current.cid
    );
  }
  assert(
    isDeepStrictEqual(
      (
        await dependencies.get(
          dependencies.config.DOCUMENT_COLLECTION,
          dependencies.receipt.document.rkey
        )
      )?.value,
      dependencies.receipt.document.original.value
    )
  );
  assert(
    (
      await dependencies.get(
        dependencies.config.DOCUMENT_COLLECTION,
        dependencies.receipt.document.rkey
      )
    )?.cid === dependencies.receipt.document.original.cid
  );
  dependencies.receipt.document.restored = true;
  await dependencies.save();
  const original = dependencies.receipt.source.original,
    temporary = dependencies.receipt.source.temporary;
  const source = await readFile(dependencies.receipt.source.path, 'utf8');
  assert(
    source === original ||
      source === temporary ||
      !!dependencies.receipt.source.versions?.includes(source),
    'The fixture source changed outside this runner.'
  );
  if (source !== original)
    await writeFile(dependencies.receipt.source.path, original);
  if (temporary && !dependencies.receipt.source.deployed) {
    await dependencies.deploy();
    dependencies.receipt.source.deployed = true;
    await dependencies.save();
  }
  dependencies.receipt.source.restored = true;
  await dependencies.save();
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
