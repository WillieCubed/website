import type {} from '@atcute/atproto';
import { Client, ok } from '@atcute/client';
import { PasswordSession } from '@atcute/password-session';
import assert from 'node:assert/strict';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { publishingIdentity } from '../lib/atproto/config';
import { resolvePds } from '../lib/atproto/identity';
import { documentRkey } from '../lib/atproto/keys';

const ORIGIN = 'https://indieweb-acceptance.vercel.app';
const OWNER = 'did:plc:iyn6nc3ffqm2e3555exyrgvv';
interface RecordSnapshot {
  cid: string;
  value: Record<string, unknown>;
}
interface Journal {
  version: 1;
  did: string;
  publicationUri: string;
  publicationRkey: string;
  slug: string;
  publishedAt: string;
  documentRkey: string;
  expectedPath: string;
  originalPublication: RecordSnapshot | null;
  foreignDocuments: { rkey: string; cid: string }[];
  syncedPublication?: RecordSnapshot | null;
  syncedDocument?: RecordSnapshot | null;
  inventoryComplete: boolean;
  documentRemoved?: boolean;
  publicationRestored?: boolean;
  cleanup: 'pending' | 'passed';
}
export async function fixtureJournal(
  output: string,
  slug: string,
  published: Date | undefined,
  recovery = false
) {
  const identity = publishingIdentity();
  assert(identity.did !== OWNER);
  assert(process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, '') === ORIGIN);
  assert(
    process.env.ATPROTO_APP_PASSWORD,
    'Fixture cleanup requires its isolated publishing credential.'
  );
  const path = resolve(output, 'fixture-publication-journal.json');
  const session = await PasswordSession.login({
    service: await resolvePds(identity.did),
    identifier: identity.did,
    password: process.env.ATPROTO_APP_PASSWORD,
  });
  assert(session.did === identity.did);
  const rpc = new Client({ handler: session });
  async function get(
    collection: 'site.standard.publication' | 'site.standard.document',
    rkey: string
  ): Promise<RecordSnapshot | null> {
    const response = await rpc.get('com.atproto.repo.getRecord', {
      params: { repo: identity.did, collection, rkey },
    });
    if (!response.ok && response.data.error === 'RecordNotFound') return null;
    const record = ok(response);
    assert(record.cid);
    return { cid: record.cid, value: record.value as Record<string, unknown> };
  }
  async function documents() {
    const records: {
      rkey: string;
      cid: string;
      value: Record<string, unknown>;
    }[] = [];
    let cursor: string | undefined;
    do {
      const page = await ok(
        rpc.get('com.atproto.repo.listRecords', {
          params: {
            repo: identity.did,
            collection: 'site.standard.document',
            limit: 100,
            cursor,
          },
        })
      );
      records.push(
        ...page.records.map((record) => ({
          rkey: record.uri.slice(record.uri.lastIndexOf('/') + 1),
          cid: record.cid,
          value: record.value as Record<string, unknown>,
        }))
      );
      cursor = page.cursor;
    } while (cursor);
    return records;
  }
  async function save() {
    await writeFile(path, JSON.stringify(journal, null, 2) + '\n', {
      mode: 0o600,
    });
    await chmod(path, 0o600);
  }
  let journal: Journal;
  try {
    if (recovery) {
      journal = JSON.parse(await readFile(path, 'utf8')) as Journal;
      assert(
        journal.version === 1 &&
          journal.did === identity.did &&
          journal.publicationUri === identity.publicationUri &&
          journal.publicationRkey === identity.publicationRkey
      );
      assert(
        journal.slug === slug && journal.expectedPath === `/writings/${slug}`
      );
      assert(
        journal.documentRkey ===
          documentRkey(journal.expectedPath, new Date(journal.publishedAt))
      );
    } else {
      await assert.rejects(
        readFile(path, 'utf8'),
        (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT',
        'Refuse to overwrite an earlier fixture ownership journal.'
      );
      assert(published && Number.isFinite(published.getTime()));
      const expectedPath = `/writings/${slug}`,
        rkey = documentRkey(expectedPath, published);
      const before = await documents();
      assert(
        !before.some((record) => record.value.site === identity.publicationUri),
        'Refuse preexisting managed documents before fixture sync.'
      );
      assert(
        !before.some((record) => record.rkey === rkey),
        'The reserved fixture key belongs to another record.'
      );
      const originalPublication = await get(
        'site.standard.publication',
        identity.publicationRkey
      );
      if (originalPublication)
        assert(
          originalPublication.value.url === ORIGIN,
          'An existing publication must belong to acceptance.'
        );
      journal = {
        version: 1,
        did: identity.did,
        publicationUri: identity.publicationUri,
        publicationRkey: identity.publicationRkey,
        slug,
        publishedAt: published.toISOString(),
        documentRkey: rkey,
        expectedPath,
        originalPublication,
        foreignDocuments: before.map(({ rkey, cid }) => ({ rkey, cid })),
        inventoryComplete: false,
        cleanup: 'pending',
      };
      await save();
    }
  } catch (error) {
    await session.logout();
    throw error;
  }
  async function observe() {
    const publication = await get(
      'site.standard.publication',
      journal.publicationRkey
    );
    const document = await get('site.standard.document', journal.documentRkey);
    if (journal.inventoryComplete) {
      if (publication)
        assert(
          publication.cid === journal.syncedPublication?.cid ||
            publication.cid === journal.originalPublication?.cid,
          'The publication CID changed outside a journaled owned version. Refuse to adopt it during cleanup.'
        );
      if (document)
        assert(
          document.cid === journal.syncedDocument?.cid,
          'The document CID changed outside its journaled owned version. Refuse to adopt it during cleanup.'
        );
    }
    if (publication) assert(publication.value.url === ORIGIN);
    if (document)
      assert(
        document.value.site === journal.publicationUri &&
          document.value.path === journal.expectedPath
      );
    journal.syncedPublication = publication;
    journal.syncedDocument = document;
    journal.inventoryComplete = true;
    await save();
  }
  return {
    observe,
    async cleanup() {
      try {
        if (!journal.inventoryComplete) await observe();
        if (!journal.documentRemoved) {
          const current = await get(
            'site.standard.document',
            journal.documentRkey
          );
          if (current) {
            assert(
              journal.syncedDocument &&
                current.cid === journal.syncedDocument.cid
            );
            assert(
              current.value.site === journal.publicationUri &&
                current.value.path === journal.expectedPath
            );
            await ok(
              rpc.post('com.atproto.repo.deleteRecord', {
                input: {
                  repo: identity.did,
                  collection: 'site.standard.document',
                  rkey: journal.documentRkey,
                  swapRecord: current.cid,
                },
              })
            );
          }
          assert(
            (await get('site.standard.document', journal.documentRkey)) === null
          );
          journal.documentRemoved = true;
          await save();
        } else
          assert(
            (await get('site.standard.document', journal.documentRkey)) === null
          );
        if (!journal.publicationRestored) {
          const current = await get(
            'site.standard.publication',
            journal.publicationRkey
          );
          if (journal.originalPublication) {
            assert(current && current.value.url === ORIGIN);
            if (current.cid !== journal.originalPublication.cid) {
              assert(
                journal.syncedPublication &&
                  current.cid === journal.syncedPublication.cid
              );
              await ok(
                rpc.post('com.atproto.repo.putRecord', {
                  input: {
                    repo: identity.did,
                    collection: 'site.standard.publication',
                    rkey: journal.publicationRkey,
                    record: journal.originalPublication.value,
                    swapRecord: current.cid,
                  },
                })
              );
            }
            assert.deepEqual(
              (await get('site.standard.publication', journal.publicationRkey))
                ?.value,
              journal.originalPublication.value
            );
          } else {
            if (current) {
              assert(
                journal.syncedPublication &&
                  current.cid === journal.syncedPublication.cid &&
                  current.value.url === ORIGIN
              );
              await ok(
                rpc.post('com.atproto.repo.deleteRecord', {
                  input: {
                    repo: identity.did,
                    collection: 'site.standard.publication',
                    rkey: journal.publicationRkey,
                    swapRecord: current.cid,
                  },
                })
              );
            }
            assert(
              (await get(
                'site.standard.publication',
                journal.publicationRkey
              )) === null
            );
          }
          journal.publicationRestored = true;
          await save();
        }
        if (journal.originalPublication)
          assert.deepEqual(
            (await get('site.standard.publication', journal.publicationRkey))
              ?.value,
            journal.originalPublication.value
          );
        else
          assert(
            (await get(
              'site.standard.publication',
              journal.publicationRkey
            )) === null
          );
        const remaining = await documents();
        for (const original of journal.foreignDocuments)
          assert(
            remaining.some(
              (current) =>
                current.rkey === original.rkey && current.cid === original.cid
            ),
            'A preexisting foreign record changed. Refuse a successful cleanup claim.'
          );
        journal.cleanup = 'passed';
        await save();
      } finally {
        await session.logout();
      }
    },
  };
}
