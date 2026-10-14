export interface IndieAuthVerificationOptions {
  bearer: string;
  expectedMe: string;
  /** A scope the token must carry; given a list, any one of them passes. */
  requiredScope?: string | string[];
  /** Where issued tokens live; the Postgres store unless a test passes one. */
  store?: IndieAuthStore;
  now?: Date;
}

/** An authorization request the consent page has checked. */
export interface IndieAuthAuthorizationRequest {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  /** The supported scopes the client asked for, in the order it asked. */
  scope: string[];
}

/** What the authorization endpoint stored when it issued a code. */
export interface IndieAuthCodeRecord {
  /** Added during redemption to bind later tokens to the spent code. */
  authorizationCodeHash?: string;
  clientId: string;
  redirectUri: string;
  me: string;
  scope: string[];
  codeChallenge: string;
  expiresAt: Date;
}

/** What the token endpoint stored when it issued an access token. */
export interface IndieAuthTokenRecord {
  clientId: string;
  me: string;
  scope: string[];
  issuedAt: Date;
  expiresAt: Date;
  /** Absent on tokens issued before refresh grants existed. */
  refreshFamilyId?: string;
}

/** The original grant and the first hashed refresh token. */
export interface IndieAuthTokenGrant extends IndieAuthTokenRecord {
  authorizationCodeHash?: string;
  refreshFamilyId: string;
  refreshTokenHash: string;
  refreshExpiresAt: Date;
}

/** Replacement credentials for one atomic refresh rotation. */
export interface IndieAuthRefreshRotation {
  refreshTokenHash: string;
  clientId: string;
  /** Null preserves the original approved access scopes. */
  scope: string[] | null;
  nextRefreshTokenHash: string;
  accessTokenHash: string;
  now: Date;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
}

export type IndieAuthRefreshResult =
  | { ok: true; record: IndieAuthTokenRecord }
  | { ok: false; error: 'invalid_grant' | 'invalid_scope' };

/**
 * Where codes and tokens live. Keys are SHA-256 digests, so the store never
 * holds a value that works as a credential. `consumeCode` marks the code used
 * whatever happens next, so a code redeems at most once.
 */
export interface IndieAuthStore {
  saveCode: (codeHash: string, record: IndieAuthCodeRecord) => Promise<void>;
  consumeCode: (
    codeHash: string,
    now: Date
  ) => Promise<IndieAuthCodeRecord | null>;
  saveToken: (tokenHash: string, record: IndieAuthTokenRecord) => Promise<void>;
  /** Persist the access token, refresh token, and grant in one transaction. */
  saveTokenGrant: (
    tokenHash: string,
    grant: IndieAuthTokenGrant
  ) => Promise<boolean | void>;
  /** Serialize on the family; reuse revokes every token in that family. */
  rotateRefreshToken: (
    rotation: IndieAuthRefreshRotation
  ) => Promise<IndieAuthRefreshResult>;
  /** The token when it exists, is unexpired, and has not been revoked. */
  findToken: (
    tokenHash: string,
    now: Date
  ) => Promise<IndieAuthTokenRecord | null>;
  revokeToken: (tokenHash: string, now: Date) => Promise<void>;
}

/** The `profile` object returned when the `profile` scope was granted. */
export interface IndieAuthProfile {
  name: string;
  url: string;
  photo: string;
  email?: string;
}

/** What a client learns about itself from its `client_id` URL. */
export interface IndieAuthClientInfo {
  name?: string;
  url?: string;
  logo?: string;
  redirectUris: string[];
}

export type IndieAuthClientFetcher = (
  clientId: string
) => Promise<IndieAuthClientInfo>;

/** The authenticated owner identity required to approve a client. */
export interface OwnerAuthenticator {
  verify: (request: Request) => Promise<OwnerCheck>;
}

export type OwnerCheck = { ok: true } | { ok: false; reason: 'invalid' };

export interface IndieAuthEndpointOptions {
  store: IndieAuthStore;
  /** Null when no owner check is configured, which turns sign-in off. */
  owner: OwnerAuthenticator | null;
  fetchClient: IndieAuthClientFetcher;
  introspectionSecret?: string;
  now?: () => Date;
}
