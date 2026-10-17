import type { Blob } from '@atcute/lexicons';
import type {
  SiteStandardDocument,
  SiteStandardPublication,
} from '@atcute/standard-site';

import type { Collection } from './config';

/** An image ready to upload, and the blob reference a record carries for it. */
export interface LocalBlob {
  ref: Blob;
  bytes: Uint8Array;
}

type RecordValue = SiteStandardPublication.Main | SiteStandardDocument.Main;

/** A record as the site's content says it should be. */
export interface DesiredRecord {
  collection: Collection;
  rkey: string;
  value: RecordValue;
  /** Blobs `value` references, uploaded only when the record is written. */
  blobs: LocalBlob[];
  removeFields?: string[];
}

/** The identity of one immutable revision of a repository record. */
export interface RepoRecordReference {
  uri: string;
  cid: string;
}

/** A record read from its repository, before its value has been validated. */
export interface RepoRecord extends RepoRecordReference {
  value: Record<string, unknown>;
}

/** A record as the PDS lists it. */
export interface ExistingRecord {
  collection: Collection;
  rkey: string;
  cid: string;
  value: Record<string, unknown>;
}

export type Write =
  | {
      $type: 'com.atproto.repo.applyWrites#create';
      collection: Collection;
      rkey: string;
      value: Record<string, unknown>;
    }
  | {
      $type: 'com.atproto.repo.applyWrites#update';
      collection: Collection;
      rkey: string;
      value: Record<string, unknown>;
    }
  | {
      $type: 'com.atproto.repo.applyWrites#delete';
      collection: Collection;
      rkey: string;
    };

/** The few repo calls the sync makes; tests pass a fake. */
export interface RepoClient {
  listRecords(collection: Collection): Promise<ExistingRecord[]>;
  applyWrites(writes: Write[]): Promise<void>;
  uploadBlob(blob: LocalBlob): Promise<void>;
  close(): Promise<void>;
  getRecord?(collection: string, rkey: string): Promise<RepoRecord | null>;
  createRecord?(
    collection: string,
    rkey: string,
    value: Record<string, unknown>
  ): Promise<RepoRecordReference>;
  putRecord?(
    collection: string,
    rkey: string,
    value: Record<string, unknown>,
    cid: string
  ): Promise<void>;
}
