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
  records: {
    uri: string;
    cid: string;
    kind: 'subscription' | 'recommendation';
    target: string;
  }[];
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
