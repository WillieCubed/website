import type { BrowserContext, Page } from '@playwright/test';

export interface CapturedSocialRecord {
  uri: string;
  cid: string;
  kind: 'subscription' | 'recommendation';
  target: unknown;
}

export interface OwnedSocialRecord extends CapturedSocialRecord {
  target: string;
}

export interface CapturedGrant {
  did: string;
  sessionHash: string;
  callbackStateHash: string;
  outcome: string;
}

export interface CapturedFlow {
  file: string;
  page: Page;
  ownedSocialRecords: CapturedSocialRecord[];
  grant: CapturedGrant;
}

export interface AuthorizationFlow {
  (
    context: BrowserContext,
    handle: string,
    expectation: 'grant' | 'cancel' | 'expired',
    filename: string,
    action?: 'subscription' | 'recommendation',
    withholdDelivery?: boolean
  ): Promise<CapturedFlow>;
}

export interface VerifiedRuntime {
  document?:
    | {
        uri: string;
        cid: string;
        sourceHash: string;
        dirtyFixtureOverlay?: true;
      }
    | undefined;
  publication: string;
  cid: string;
  dirtyFixtureOverlay?: boolean | undefined;
  revision: string;
}

export interface LocalVerifier {
  revision: string;
  sourceHashes: Record<string, string>;
  deployedCode: boolean;
}

export interface CaptureOptions {
  workspace?: string | undefined;
  slug?: string | undefined;
  env: string;
  output: string;
  'refresh-wait-seconds': string;
  'cleanup-only': boolean;
  'defer-bluesky': boolean;
  'authorization-only': boolean;
  'cookie-delivery-failure': boolean;
  'social-only': boolean;
  'fixture-source-journal'?: string | undefined;
  'fixture-publication-journal'?: string | undefined;
  'social-runtime-revision'?: string | undefined;
}

export interface OwnedBrowser {
  did: string;
  sessionHash: string;
  grantCreated: boolean;
  inventoryComplete: boolean;
  pendingMutation?:
    | {
        kind: 'subscription' | 'recommendation';
        before: { uri: string; cid: string }[];
        dispatchedAt?: string;
        responseCompletedAt?: string;
        quiescedAt?: string;
        target: string;
      }
    | undefined;
  recordsClean?: boolean | undefined;
  grantRevoked?: boolean | undefined;
  dpopSpkiSha256?: string | undefined;
  sessionSource?: 'callback-response' | undefined;
  records: OwnedSocialRecord[];
}

export interface PendingGrant {
  did: string;
  stateHash: string;
  flowHash: string;
  encryptedStateHash: string;
  dpopSpkiSha256: string;
  issuer: string;
  audience: string;
  kind: 'subscription' | 'recommendation';
  beforeRecords: { uri: string; cid: string }[];
  beforeBrowsers: string[];
  priorGrantKeys: string[];
  callbackCompleted?: boolean | undefined;
  responseSessionHash?: string | undefined;
}

export interface AuthorizationBaseline {
  origin: string;
  publisher: string;
  runtimeRevision: string;
  database: { [k: string]: { key: string; rowHash: string }[] };
  graphs: { uri: string; cid: string; value: Record<string, unknown> }[];
  expiredStates: { key: string; expiresAt: string; rowHash: string }[];
}

export interface RunContext {
  notificationCleanup: (() => Promise<void>) | undefined;
  finalNotification: (() => Promise<void>) | undefined;
  fixtureCleanup: (() => Promise<void>) | undefined;
  sourceCleanup: (() => Promise<void>) | undefined;
  lifecycleCleanup: (() => Promise<void>) | undefined;
  publicationCleanupVerified: boolean;
  browserCleanupSucceeded: boolean;
  phase: string;
  recoveryPath: string;
}
