export interface RecordSnapshot {
  cid: string;
  value: Record<string, unknown>;
}

export interface Snapshot extends RecordSnapshot {
  uri: string;
}

export interface Owned {
  previous?: { cid: string; value: Record<string, unknown> }[] | undefined;
  collection: string;
  rkey: string;
  value: Record<string, unknown> | null;
  cid?: string | undefined;
  deleted?: boolean | undefined;
}

export interface Receipt {
  cleanupSourceFiles?: Record<string, string> | undefined;
  verifierSourceFiles?: Record<string, string> | undefined;
  version: 1;
  origin: string;
  did: string;
  slug: string;
  deploymentRecovery?:
    | {
        mode: 'verified-owned-artifact';
        revision: string;
        baseGitRevision: string;
        dirtyFixtureOverlay: true;
        runtimeCodeUnchanged: true;
        sourceJournal: string;
        publicationJournal: string;
        sourceSha256: string;
        observedAt: string;
      }
    | undefined;
  retainedRuntime?:
    | {
        revision: string;
        baseGitRevision?: string;
        dirtyFixtureOverlay?: true;
        runtimeCodeUnchanged?: true;
        sourceJournal: string;
        publicationJournal: string;
        sourceSha256: string;
        nonce: string;
        publishedAt: string;
        documentUri: string;
        limits: string[];
      }
    | undefined;
  source: {
    path: string;
    original: string;
    temporary?: string;
    versions?: string[];
    restored?: boolean;
    deployed?: boolean;
  };
  document: {
    rkey: string;
    original: Snapshot;
    expected?: Record<string, unknown>;
    restored?: boolean;
  };
  foreignDocuments: { rkey: string; cid: string }[];
  owned: Owned[];
  checks: { name: string; observedAt: string; details?: unknown }[];
  screenshots: string[];
  cleanup: 'pending' | 'passed';
  error?: string | undefined;
}

export interface PostView {
  uri: string;
  record: { text?: string };
  embed?:
    | { $type: string; playlist?: string; images?: { fullsize: string }[] }
    | undefined;
}

export interface Thread {
  post?: PostView | undefined;
  replies?: Thread[] | undefined;
}

export interface RuntimeExpectation {
  revision: string;
  did: string;
  slug: string;
  nonce: string;
  publishedAt: string;
  documentRkey: string;
  sourceSha256: string;
}
export interface RuntimeSourceJournal {
  version: number;
  workspace: string;
  slug: string;
  cleanup: string;
  original: string;
  sha256: string;
  removed?: boolean;
  source?: string;
  deployedRevision?: string;
}
export interface PublicationJournal {
  version: number;
  did: string;
  publicationUri: string;
  publicationRkey: string;
  slug: string;
  publishedAt: string;
  documentRkey: string;
  expectedPath: string;
  inventoryComplete: boolean;
  cleanup: string;
  documentRemoved?: boolean;
  publicationRestored?: boolean;
  syncedDocument?: RecordSnapshot | null;
  syncedPublication?: RecordSnapshot | null;
}

export type CompletePublicationJournal = PublicationJournal & {
  syncedDocument: RecordSnapshot;
  syncedPublication: RecordSnapshot;
};
