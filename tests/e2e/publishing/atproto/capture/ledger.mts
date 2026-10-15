import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { RepoRecordReference } from '../../../../../lib/atproto/types';
import { privateWrite } from '../../../../support/publishing/identities/journal.mts';
import type {
  CallbackObservation,
  OwnedBrowser,
  OwnedSocialRecord,
  PendingGrant,
} from './types.mts';

export interface IssuedAuthorizationState {
  key: string;
  did: string;
  encryptedHash: string;
  flowHash: string;
}
interface LedgerOptions {
  output: string;
  origin: string;
  publisher: string;
  forbiddenOwner: string;
  providerOrigin?: string;
}
interface BrowserIdentity {
  did: string;
  sessionHash: string;
  grantCreated: boolean;
  dpopSpkiSha256?: string;
  sessionSource?: 'callback-response';
}
interface BrowserOwnershipJournal {
  origin: string;
  publisher: string;
  owned: OwnedBrowser[];
}
interface BrowserCredentials {
  browserTokens: Record<string, string>;
}
interface PendingGrantJournal {
  origin: string;
  publisher: string;
  pending: PendingGrant[];
}
interface LedgerIdentity {
  origin: string;
  publisher: string;
}
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const isHash = (value: string) => /^[a-f0-9]{64}$/.test(value);

/** Owns capture recovery checkpoints; callers receive detached snapshots, never writable journals or token maps. */
export class CaptureLedger {
  #options: LedgerOptions;
  #browsers = new Map<string, OwnedBrowser>();
  #tokens = new Map<string, string>();
  #pending = new Map<string, PendingGrant>();
  #states = new Map<string, IssuedAuthorizationState>();
  #tail: Promise<unknown> = Promise.resolve();

  constructor(options: LedgerOptions) {
    this.#options = { ...options };
  }
  browsers(): OwnedBrowser[] {
    return structuredClone([...this.#browsers.values()]);
  }
  browser(sessionHash: string): OwnedBrowser | undefined {
    return structuredClone(this.#browsers.get(sessionHash));
  }
  pendingGrants(): PendingGrant[] {
    return structuredClone([...this.#pending.values()]);
  }
  issuedStates(): IssuedAuthorizationState[] {
    return structuredClone([...this.#states.values()]);
  }

  async initialize(): Promise<void> {
    await this.#serialize(() =>
      this.#writeBrowsers(this.#browsers, this.#tokens)
    );
  }

  async recordIssuedState(state: IssuedAuthorizationState): Promise<void> {
    await this.#serialize(async () => {
      this.#validateState(state);
      const previous = this.#states.get(state.key);
      if (previous)
        assert.deepEqual(previous, state, 'An issued state cannot be rebound.');
      const states = new Map(this.#states).set(
        state.key,
        structuredClone(state)
      );
      await this.#write('authorization-states.json', [...states.values()]);
      this.#states = states;
    });
  }

  async restoreIssuedStates(): Promise<void> {
    const states: IssuedAuthorizationState[] = await this.#read(
      'authorization-states.json'
    );
    assert(Array.isArray(states));
    for (const state of states) this.#validateState(state);
    this.#states = new Map(states.map((state) => [state.key, state]));
  }

  async beginGrant(intent: PendingGrant): Promise<PendingGrant> {
    return this.#serialize(async () => {
      this.#validateGrant(intent);
      assert(
        !this.#pending.has(intent.stateHash),
        'A pending state is already owned.'
      );
      const pending = new Map(this.#pending).set(
        intent.stateHash,
        structuredClone(intent)
      );
      await this.#writePending(pending);
      this.#pending = pending;
      return structuredClone(intent);
    });
  }

  async recordCallback(
    stateHash: string,
    callback: CallbackObservation
  ): Promise<PendingGrant> {
    return this.#serialize(async () => {
      const intent = this.#pending.get(stateHash);
      assert(intent, 'The callback must have a persisted pending intent.');
      assert.equal(callback.actualStatus, 303);
      const token = callback.setCookie.match(
        /^atproto_session=([a-f0-9]{64})(?:;|$)/
      )?.[1];
      assert(
        token,
        'A completed grant callback must return its real session cookie.'
      );
      const responseSessionHash = hash(token);
      assert(!intent.beforeBrowsers.includes(responseSessionHash));
      if (intent.responseSessionHash)
        assert.equal(intent.responseSessionHash, responseSessionHash);
      const observed = {
        ...intent,
        responseSessionHash,
        callbackCompleted: true,
      };
      await this.#write(`pending-callback-${stateHash}.json`, {
        ...callback,
        callbackCompleted: true,
        stateHash,
      });
      const pending = new Map(this.#pending).set(stateHash, observed);
      await this.#writePending(pending);
      this.#pending = pending;
      return structuredClone(observed);
    });
  }

  async restorePendingGrants(): Promise<void> {
    const journal = await this.#read<PendingGrantJournal>(
      'pending-grants.json'
    );
    this.#validateJournal(journal);
    assert(Array.isArray(journal.pending));
    for (const intent of journal.pending) this.#validateGrant(intent);
    this.#pending = new Map(
      journal.pending.map((intent) => [intent.stateHash, intent])
    );
  }

  async beginInventory(
    identity: BrowserIdentity,
    token: string
  ): Promise<OwnedBrowser> {
    return this.#serialize(async () => {
      this.#validateIdentity(identity, token);
      const previous = this.#browsers.get(identity.sessionHash);
      if (previous) this.#assertSameBrowser(previous, identity);
      const owner: OwnedBrowser = previous ?? {
        ...identity,
        inventoryComplete: false,
        records: [],
      };
      const browsers = new Map(this.#browsers).set(
        identity.sessionHash,
        structuredClone(owner)
      );
      const tokens = new Map(this.#tokens).set(identity.sessionHash, token);
      // This session already exists at the provider. Finally cleanup must retain
      // its observed identity and private credential even if checkpointing fails.
      this.#browsers = browsers;
      this.#tokens = tokens;
      await this.#writeBrowsers(browsers, tokens);
      return structuredClone(owner);
    });
  }

  async completeInventory(
    sessionHash: string,
    records: OwnedSocialRecord[]
  ): Promise<OwnedBrowser> {
    return this.#editBrowser(sessionHash, (owner) => {
      owner.records = structuredClone(records);
      owner.inventoryComplete = true;
    });
  }

  async restoreBrowsers(): Promise<void> {
    const journal = await this.#read<BrowserOwnershipJournal>(
      'cleanup-ownership.json'
    );
    this.#validateJournal(journal);
    assert(Array.isArray(journal.owned));
    const credentials = await this.#read<BrowserCredentials>(
      'cleanup-credentials.json'
    );
    const browsers = new Map<string, OwnedBrowser>();
    const tokens = new Map<string, string>();
    for (const owner of journal.owned) {
      const token = credentials.browserTokens[owner.sessionHash];
      this.#validateIdentity(owner, token);
      this.#validateRecords(owner);
      browsers.set(owner.sessionHash, owner);
      tokens.set(owner.sessionHash, token);
    }
    this.#browsers = browsers;
    this.#tokens = tokens;
  }

  async withBrowserToken<T>(
    sessionHash: string,
    operation: (token: string) => Promise<T>
  ): Promise<T> {
    const token = this.#tokens.get(sessionHash);
    assert(token, 'No private credential belongs to this browser.');
    return operation(token);
  }

  async beginMutation(
    sessionHash: string,
    kind: 'subscription' | 'recommendation',
    target: string,
    before: RepoRecordReference[]
  ): Promise<OwnedBrowser> {
    return this.#editBrowser(sessionHash, (owner) => {
      assert(
        owner.inventoryComplete,
        'Complete the owned inventory before a new mutation.'
      );
      assert(
        !owner.pendingMutation,
        'The prior mutation needs recovery first.'
      );
      assert(
        target.startsWith(`at://${this.#options.publisher}/site.standard.`)
      );
      assert(
        before.every((record) =>
          owner.records.some(
            (known) => known.uri === record.uri && known.cid === record.cid
          )
        )
      );
      owner.pendingMutation = { kind, before: structuredClone(before), target };
      owner.inventoryComplete = false;
    });
  }

  async markMutationDispatched(
    sessionHash: string,
    kind: 'subscription' | 'recommendation',
    dispatchedAt = new Date().toISOString()
  ): Promise<OwnedBrowser> {
    assert.equal(new Date(dispatchedAt).toISOString(), dispatchedAt);
    return this.#editBrowser(sessionHash, (owner) => {
      assert.equal(owner.pendingMutation?.kind, kind);
      owner.pendingMutation!.dispatchedAt = dispatchedAt;
    });
  }
  async markMutationResponse(
    sessionHash: string,
    kind: 'subscription' | 'recommendation'
  ): Promise<OwnedBrowser> {
    return this.#editBrowser(sessionHash, (owner) => {
      assert.equal(owner.pendingMutation?.kind, kind);
      owner.pendingMutation!.responseCompletedAt = new Date().toISOString();
    });
  }
  async markMutationQuiesced(sessionHash: string): Promise<OwnedBrowser> {
    return this.#editBrowser(sessionHash, (owner) => {
      assert(owner.pendingMutation);
      owner.pendingMutation.quiescedAt = new Date().toISOString();
    });
  }
  async completeMutation(
    sessionHash: string,
    records: OwnedSocialRecord[]
  ): Promise<OwnedBrowser> {
    return this.#editBrowser(sessionHash, (owner) => {
      assert(owner.pendingMutation);
      this.#mergeRecords(owner, records);
      owner.inventoryComplete = true;
      owner.pendingMutation = undefined;
    });
  }
  async mergeRecords(
    sessionHash: string,
    records: OwnedSocialRecord[]
  ): Promise<OwnedBrowser> {
    return this.#editBrowser(sessionHash, (owner) =>
      this.#mergeRecords(owner, records)
    );
  }
  async markRecordsClean(
    sessionHash: string,
    clean: boolean
  ): Promise<OwnedBrowser> {
    return this.#editBrowser(sessionHash, (owner) => {
      if (clean) assert(owner.inventoryComplete && !owner.pendingMutation);
      owner.recordsClean = clean;
    });
  }
  async markGrantRevoked(sessionHash: string): Promise<OwnedBrowser> {
    return this.#editBrowser(sessionHash, (owner) => {
      assert(
        owner.grantCreated &&
          owner.recordsClean &&
          owner.inventoryComplete &&
          !owner.pendingMutation
      );
      owner.grantRevoked = true;
    });
  }

  #serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.#tail.then(operation);
    this.#tail = next.catch(() => undefined);
    return next;
  }
  #editBrowser(
    sessionHash: string,
    edit: (owner: OwnedBrowser) => void
  ): Promise<OwnedBrowser> {
    return this.#serialize(async () => {
      const owner = this.browser(sessionHash);
      assert(owner, 'Browser ownership must be checkpointed first.');
      edit(owner);
      this.#validateRecords(owner);
      const browsers = new Map(this.#browsers).set(sessionHash, owner);
      await this.#writeBrowsers(browsers, this.#tokens);
      this.#browsers = browsers;
      return structuredClone(owner);
    });
  }
  #mergeRecords(owner: OwnedBrowser, records: OwnedSocialRecord[]): void {
    for (const record of records) {
      const known = owner.records.find((value) => value.uri === record.uri);
      if (known)
        assert.deepEqual(
          known,
          record,
          'An owned record changed outside this run.'
        );
      else owner.records.push(structuredClone(record));
    }
  }
  #validateJournal(journal: LedgerIdentity): void {
    assert.equal(journal.origin, this.#options.origin);
    assert.equal(journal.publisher, this.#options.publisher);
  }
  #validateIdentity(identity: BrowserIdentity, token: string): void {
    assert(
      identity.did !== this.#options.forbiddenOwner &&
        identity.did.startsWith('did:')
    );
    assert(
      isHash(identity.sessionHash) &&
        typeof token === 'string' &&
        hash(token) === identity.sessionHash
    );
  }
  #assertSameBrowser(previous: OwnedBrowser, identity: BrowserIdentity): void {
    assert.equal(previous.did, identity.did);
    assert.equal(previous.grantCreated, identity.grantCreated);
    assert.equal(previous.dpopSpkiSha256, identity.dpopSpkiSha256);
  }
  #validateState(state: IssuedAuthorizationState): void {
    assert(
      state.did !== this.#options.forbiddenOwner && state.did.startsWith('did:')
    );
    assert([state.key, state.encryptedHash, state.flowHash].every(isHash));
  }
  #validateGrant(intent: PendingGrant): void {
    const state = this.#states.get(intent.stateHash);
    assert(
      state &&
        state.did === intent.did &&
        state.encryptedHash === intent.encryptedStateHash &&
        state.flowHash === intent.flowHash
    );
    assert(isHash(intent.dpopSpkiSha256));
    assert.deepEqual(intent.priorGrantKeys, []);
    assert.deepEqual(intent.beforeRecords, []);
    assert.equal(intent.did, this.#options.publisher);
    assert.equal(intent.kind, 'subscription');
    if (this.#options.providerOrigin)
      assert.equal(intent.issuer, this.#options.providerOrigin);
    assert.equal(intent.audience, new URL(intent.issuer).href);
    if (intent.responseSessionHash) assert(isHash(intent.responseSessionHash));
  }
  #validateRecords(owner: OwnedBrowser): void {
    for (const record of owner.records) {
      const collection =
        record.kind === 'subscription' ? 'subscription' : 'recommend';
      assert(
        record.uri.startsWith(
          `at://${owner.did}/site.standard.graph.${collection}/`
        )
      );
      assert(['subscription', 'recommendation'].includes(record.kind));
      assert(typeof record.cid === 'string' && record.cid.length > 0);
      assert(
        record.target.startsWith(
          `at://${this.#options.publisher}/site.standard.`
        )
      );
    }
  }
  async #writeBrowsers(
    browsers: Map<string, OwnedBrowser>,
    tokens: Map<string, string>
  ): Promise<void> {
    // Persist credentials before publishing an inventory that requires them to recover.
    await this.#write('cleanup-credentials.json', {
      browserTokens: Object.fromEntries(tokens),
    });
    await this.#write('cleanup-ownership.json', {
      origin: this.#options.origin,
      publisher: this.#options.publisher,
      owned: [...browsers.values()],
    });
  }
  async #writePending(pending: Map<string, PendingGrant>): Promise<void> {
    await this.#write('pending-grants.json', {
      origin: this.#options.origin,
      publisher: this.#options.publisher,
      pending: [...pending.values()],
    });
  }
  async #write(name: string, value: unknown): Promise<void> {
    const path = resolve(this.#options.output, name);
    await privateWrite(path, JSON.stringify(value, null, 2) + '\n');
  }
  async #read<T>(name: string): Promise<T> {
    return JSON.parse(
      await readFile(resolve(this.#options.output, name), 'utf8')
    );
  }
}
