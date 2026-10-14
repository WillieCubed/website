export type OwnedAccount = {
  handle: string;
  email: string;
  password: string;
  did?: string;
  appPassword?: string;
  invite?: string;
  confirmed?: boolean;
  deactivated?: boolean;
  deactivationRequested?: boolean;
  probe?: {
    rkey: string;
    value: Record<string, unknown>;
    cid?: string;
    removed?: boolean;
  };
  profile?: { value: Record<string, unknown>; cid?: string; removed?: boolean };
};
export type XrpcReply = {
  did?: string;
  accessJwt: string;
  refreshJwt: string;
  code: string;
  password: string;
  cid: string;
  emailConfirmed?: boolean;
  inviteCodeRequired?: boolean;
  availableUserDomains: string[];
  handle: string;
  posts: { uri: string; cid: string; author: { did: string } }[];
  collections: string[];
  records: { uri: string; cid: string; value: Record<string, unknown> }[];
  cursor?: string;
};
type Worker = {
  name: string;
  source: string;
  versions: string[];
  removed?: boolean;
};
export type Journal = {
  version: 1;
  account: string;
  domain: string;
  run: string;
  marker: string;
  origin: string;
  container: string;
  port: number;
  image: string;
  data: string;
  adminPassword: string;
  jwtSecret: string;
  rotationKey: string;
  tunnel?: { pid: number; upstream: string; command: string };
  retiredTunnels?: { pid: number; stoppedAt: string }[];
  repairedAt?: string;
  workers: Worker[];
  publisher: OwnedAccount;
  visitor: OwnedAccount;
  started: string;
  serverVersion?: string;
  advertisedVersion?: string;
  federation?: string;
  configured?: boolean;
  cleaned?: string;
  cleanupDataAuthorized?: boolean;
  containerRemoved?: boolean;
  tunnelStopped?: boolean;
  storage?: {
    volume: string;
    rollbackContainer: string;
    volumeContainer: string;
    active: boolean;
    phase:
      | 'planned'
      | 'stopped'
      | 'copied'
      | 'renamed'
      | 'verified'
      | 'rolled-back';
    manifest?: { path: string; bytes: number; sha256: string }[];
    records?: { uri: string; cid: string }[];
    sqliteChecks?: number;
    helpers: { name: string; script: string; source?: string }[];
    rollbackRequested?: boolean;
    rollbackRecordsVerified?: boolean;
    removed?: boolean;
  };
};
