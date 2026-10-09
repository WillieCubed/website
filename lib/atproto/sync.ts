import { safeParse } from '@atcute/lexicons';
import {
  SiteStandardDocument,
  SiteStandardPublication,
} from '@atcute/standard-site';

import { absoluteUrl, site } from '@/lib/site';

import { fetchImageBlob } from './blobs';
import { validateExplicitBlueskyCopies } from './bluesky';
import { createRepoClient } from './client';
import {
  DOCUMENT_COLLECTION,
  PUBLICATION_COLLECTION,
  PUBLICATION_URI,
  appPassword,
  publishingIdentity,
} from './config';
import { documentRkey } from './keys';
import { DOCUMENT_EXTENSION_FIELDS, publicationSettings } from './metadata';
import { planSync } from './plan';
import {
  type DocumentSource,
  documentPath,
  documentRecord,
  publicationRecord,
} from './records';
import type { DesiredRecord, LocalBlob, RepoClient } from './types';

export type SyncReport =
  | { status: 'skipped'; reason: string }
  | {
      status: 'planned' | 'synced';
      created: number;
      updated: number;
      deleted: number;
      unchanged: number;
      writes: { action: 'create' | 'update' | 'delete'; uri: string }[];
    };

export interface SyncOptions {
  /** Plan and report without uploading or writing anything. */
  dryRun?: boolean;
  /** A repo client; tests pass a fake. Defaults to one signed in with ATPROTO_APP_PASSWORD. */
  client?: RepoClient;
  /** Signs in with the app password when no `client` is given; tests pass a fake. */
  createClient?: (password: string) => Promise<RepoClient>;
  /** Published writings; defaults to reading content/writings. */
  writings?: DocumentSource[];
  fetchImage?: (url: string) => Promise<LocalBlob | null>;
}

/**
 * Every published writing, read without the Next.js cache. A loader error
 * propagates rather than yielding a short list: planSync deletes whatever
 * the content no longer produces, so a failed read must never look like
 * "nothing is published".
 */
async function publishedWritings(): Promise<DocumentSource[]> {
  const { getWritingSlugs, loadWriting } = await import('@/lib/writings');
  const sources: DocumentSource[] = [];
  for (const slug of await getWritingSlugs()) {
    const { writing, content } = await loadWriting(slug);
    if (writing.draft) continue;
    sources.push({
      slug,
      title: writing.title,
      description: writing.description,
      published: writing.published,
      lastUpdated: writing.lastUpdated,
      tags: writing.tags,
      body: content,
      contentFormat: writing.contentFormat,
      photos: writing.photos,
      micropub: writing.micropub,
      audio: writing.audio,
      video: writing.video,
      image: writing.featuredImage,
      atproto: writing.atproto,
    });
  }
  return sources;
}

async function desiredRecords(
  writings: DocumentSource[],
  fetchImage: (url: string) => Promise<LocalBlob | null>
): Promise<DesiredRecord[]> {
  const icon = await fetchImage(absoluteUrl(site.author.photo));
  const records: DesiredRecord[] = [
    {
      collection: PUBLICATION_COLLECTION,
      rkey: publishingIdentity().publicationRkey,
      value: publicationRecord(icon?.ref),
      blobs: icon ? [icon] : [],
      removeFields: publicationSettings().labels === null ? ['labels'] : [],
    },
  ];
  for (const writing of writings) {
    const path = documentPath(writing.slug);
    // `||`, not `??`: a `featuredImage: ''` in frontmatter means none, and
    // an empty URL would fetch the homepage. The page does the same.
    const cover = await fetchImage(
      absoluteUrl(writing.image || `${path}/opengraph-image`)
    );
    records.push({
      collection: DOCUMENT_COLLECTION,
      rkey: documentRkey(path, writing.published),
      value: documentRecord(writing, { coverImage: cover?.ref }),
      blobs: cover ? [cover] : [],
      removeFields: DOCUMENT_EXTENSION_FIELDS.filter(
        (field) => writing.atproto?.[field] === null
      ),
    });
  }
  return records;
}

/**
 * Never publish a record its lexicon rejects: a bad value fails the sync
 * here, naming the record and the rule, rather than at the PDS or, worse,
 * in a reader. Strict mode also checks each blob's size and MIME type.
 */
function assertValid(records: DesiredRecord[]): void {
  for (const { collection, rkey, value } of records) {
    if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 900_000)
      throw new Error(
        `Record ${collection}/${rkey} exceeds the safe record size.`
      );
    const result = safeParse(
      collection === PUBLICATION_COLLECTION
        ? SiteStandardPublication.mainSchema
        : SiteStandardDocument.mainSchema,
      value,
      { strict: true }
    );
    if (!result.ok) {
      const path = 'path' in value && value.path ? ` (${value.path})` : '';
      throw new Error(
        `Refusing to publish ${collection}/${rkey}${path}: ${result.message}`
      );
    }
  }
}

/**
 * Make the repo match the published content: the publication record and
 * one document per writing. Runs after a production deploy, once the
 * pages that name these records are live (app/api/indieweb/notify).
 */
export async function syncAtproto(
  options: SyncOptions = {}
): Promise<SyncReport> {
  // Deployment credentials decide which account receives records. Acceptance
  // uses its own DID and password, and previews without credentials skip.
  if (!PUBLICATION_URI) {
    return {
      status: 'skipped',
      reason: 'NEXT_PUBLIC_ATPROTO_DID or ATPROTO_PUBLICATION_RKEY is not set',
    };
  }
  let client = options.client;
  if (!client) {
    const password = appPassword();
    if (!password) {
      return { status: 'skipped', reason: 'ATPROTO_APP_PASSWORD is not set' };
    }
    client = await (options.createClient ?? createRepoClient)(password);
  }
  const { did } = publishingIdentity();

  try {
    const writings = options.writings ?? (await publishedWritings());
    await validateExplicitBlueskyCopies(client, writings);
    const desired = await desiredRecords(
      writings,
      options.fetchImage ??
        ((url) =>
          fetchImageBlob(url, { icon: url === absoluteUrl(site.author.photo) }))
    );
    assertValid(desired);
    const existing = [
      ...(await client.listRecords(PUBLICATION_COLLECTION)),
      ...(await client.listRecords(DOCUMENT_COLLECTION)),
    ];
    const plan = planSync(desired, existing);
    assertValid(
      plan.writes
        .filter((write) => 'value' in write)
        .map((write) => ({
          collection: write.collection,
          rkey: write.rkey,
          value: ('value' in write
            ? write.value
            : {}) as DesiredRecord['value'],
          blobs: [],
        }))
    );

    if (!options.dryRun) {
      for (const blob of plan.uploads) await client.uploadBlob(blob);
      if (plan.writes.length > 0) await client.applyWrites(plan.writes);
    }

    const writes = plan.writes.map((write) => ({
      action: write.$type.slice(write.$type.indexOf('#') + 1) as
        | 'create'
        | 'update'
        | 'delete',
      uri: `at://${did}/${write.collection}/${write.rkey}`,
    }));
    const count = (action: string) =>
      writes.filter((write) => write.action === action).length;
    return {
      status: options.dryRun ? 'planned' : 'synced',
      created: count('create'),
      updated: count('update'),
      deleted: count('delete'),
      unchanged: plan.unchanged,
      writes,
    };
  } finally {
    // Sign out only of a session this call opened. A failed sign-out must
    // neither fail a sync whose writes succeeded nor mask the body's error.
    if (!options.client) {
      await client
        .close()
        .catch((error: unknown) =>
          console.warn('AT Protocol sign-out failed:', error)
        );
    }
  }
}
