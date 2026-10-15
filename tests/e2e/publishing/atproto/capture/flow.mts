import type {} from '@atcute/atproto';
import type { Did } from '@atcute/lexicons';
import type { StoredSession, StoredState } from '@atcute/oauth-node-client';
import type {
  APIResponse,
  BrowserContext,
  Response as BrowserResponse,
  Page,
  Route,
} from '@playwright/test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import type { PostgresPool } from '../../../../../lib/db/postgres';
import { callbackSignature } from '../../../../support/publishing/callback-proof.mts';
import type {
  AcceptanceIdentities,
  ProvisionedAccount,
} from '../../../../support/publishing/identities/types.mts';
import { entrypointPath } from '../../../../support/publishing/runtime.mts';
import {
  captureSocialLoading,
  captureSocialState,
} from '../../../../support/publishing/social-browser.mts';
import { captureSourceManifest } from './sources.mts';
import type {
  AuthorizationBaseline,
  CaptureOptions,
  CapturedFlow,
  LocalVerifier,
  OwnedBrowser,
  PendingGrant,
} from './types.mts';

interface Context {
  first: BrowserContext;
  resolveHandle: (handle: string) => Promise<string>;
  ownedIdentities: AcceptanceIdentities | undefined;
  db: PostgresPool;
  hash: (value: string) => string;
  graphFor: (
    did: string,
    action?: 'subscription' | 'recommendation',
    targetOnly?: boolean
  ) => Promise<{ uri: string; cid: string; value: Record<string, unknown> }[]>;
  ORIGIN: string;
  values: CaptureOptions;
  authorizationOnly: boolean;
  recordOperationFailure: (error: unknown) => Promise<void>;
  save: (name: string, value: unknown) => Promise<string>;
  decryptOAuthValue: <T>(value: string, key: string) => T;
  settings: Record<string, string>;
  existingOnly: boolean;
  authorizationBaseline: AuthorizationBaseline | undefined;
  authorizationStates: {
    key: string;
    did: string;
    encryptedHash: string;
    flowHash: string;
  }[];
  publicDpopHash: (key: StoredState['dpopKey']) => string;
  pendingGrants: PendingGrant[];
  journalPendingGrants: () => Promise<void>;
  ownership: OwnedBrowser[];
  browserTokens: Map<string, string>;
  journalOwnership: () => Promise<void>;
  authorizeOwnedProvider: (
    page: Page,
    identity: ProvisionedAccount,
    providerOrigin: string,
    expectation: 'grant' | 'cancel' | 'expired'
  ) => Promise<void>;
  assertGrantBinding: (intent: PendingGrant, stored: StoredSession) => void;
  recoverPendingGrant: (intent: PendingGrant) => Promise<void>;
  deliveryFailureObserved: boolean;
  authorizationRevision: string;
  localVerifier: LocalVerifier | undefined;
  deliveryWithheld: Error;
}

interface ProviderCallbackOutcome {
  response: BrowserResponse;
  wrongBrowserRejected: boolean;
}

export async function flow(
  dependencies: Context,
  context: BrowserContext,
  handle: string,
  expectation: 'grant' | 'cancel' | 'expired',
  filename: string,
  action: 'subscription' | 'recommendation' = 'subscription',
  withholdDelivery = false
): Promise<CapturedFlow> {
  const ownedIdentities = dependencies.ownedIdentities;
  const visitor = await dependencies.resolveHandle(handle);
  const automatedIdentity = await prepareOwnedProvider();
  const existingGrant = await dependencies.db
    .sql`SELECT key_hash FROM atproto_oauth_sessions WHERE key_hash = ${dependencies.hash(visitor)}`;
  const beforeRecords = await dependencies.graphFor(visitor, action);
  if (expectation === 'grant')
    assert.equal(
      beforeRecords.length,
      0,
      'Preexisting subscription belongs to another flow. Use a fresh acceptance publication or clean its recorded prior run first.'
    );
  const page = await context.newPage();
  const { existingSession, returnTo, startedInPage, sessionsBefore } =
    await observeFlowStart();
  const { login, loginPayload } = await beginLogin();
  const { flowCookie, own, issuedStateHash, issuedState, url } =
    await bindIssuedState();
  const pendingGrant = await journalPendingGrant();
  async function rememberCallback(response: {
    status(): number;
    headersArray(): Promise<{ name: string; value: string }[]>;
  }) {
    if (!pendingGrant) return;
    const header = (await response.headersArray()).find(
      (entry) =>
        entry.name.toLowerCase() === 'set-cookie' &&
        entry.value.startsWith('atproto_session=')
    )?.value;
    const token = header?.match(/^atproto_session=([a-f0-9]{64})(?:;|$)/)?.[1];
    {
      assert(
        token,
        'A completed grant callback must return its real session cookie.'
      );
      assert.equal(response.status(), 303);
      await dependencies.save(`pending-callback-${issuedStateHash}.json`, {
        setCookie: header,
        callbackCompleted: true,
        stateHash: issuedStateHash,
        actualStatus: response.status(),
      });
      pendingGrant.responseSessionHash = dependencies.hash(token);
    }
    pendingGrant.callbackCompleted = true;
    await dependencies.journalPendingGrants();
  }
  if (automatedIdentity) {
    assert(ownedIdentities);
    assert.equal(issuedState.issuer, ownedIdentities.origin);
    assert.equal(new URL(url).origin, ownedIdentities.origin);
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (
        request.isNavigationRequest() &&
        request.frame() === page.mainFrame()
      ) {
        const destination = new URL(request.url());
        if (
          destination.origin !== ownedIdentities.origin &&
          destination.origin !== dependencies.ORIGIN
        ) {
          await route.abort('blockedbyclient');
          return;
        }
      }
      await route.continue();
    });
  }
  let expiredKey: string | undefined;
  if (expectation === 'expired') {
    expiredKey = issuedStateHash;
    await dependencies.db
      .sql`UPDATE atproto_oauth_states SET expires_at = NOW() - INTERVAL '1 second' WHERE key_hash = ${expiredKey}`;
  }
  const responsePromise = page.waitForResponse(
    (response) => {
      const callback = new URL(response.url());
      return (
        callback.origin === dependencies.ORIGIN &&
        callback.pathname === '/atproto/callback'
      );
    },
    { timeout: automatedIdentity ? 120000 : 600000 }
  );
  void responsePromise.catch(() => {});
  explainManualProviderStep();
  async function captureSession() {
    const currentSession = (await context.cookies(dependencies.ORIGIN)).find(
      (entry) => entry.name === 'atproto_session'
    )?.value;
    if (
      currentSession &&
      currentSession !== existingSession &&
      !dependencies.ownership.some(
        (entry) => entry.sessionHash === dependencies.hash(currentSession)
      )
    ) {
      const owned: OwnedBrowser = {
        did: visitor,
        sessionHash: dependencies.hash(currentSession),
        grantCreated: existingGrant.rows.length === 0,
        ...(pendingGrant && { dpopSpkiSha256: pendingGrant.dpopSpkiSha256 }),
        inventoryComplete: false,
        records: [],
      };
      dependencies.ownership.push(owned);
      dependencies.browserTokens.set(owned.sessionHash, currentSession);
      await dependencies.journalOwnership();
      const records = await dependencies.graphFor(visitor, action);
      owned.records = records
        .filter(
          (record) => !beforeRecords.some((before) => before.uri === record.uri)
        )
        .map((record) => ({
          uri: record.uri,
          cid: record.cid,
          kind: action,
          target: record.value[
            action === 'subscription' ? 'publication' : 'document'
          ] as string,
        }));
      owned.inventoryComplete = true;
      await dependencies.journalOwnership();
    }
    return currentSession;
  }
  let callbackOutcome: ProviderCallbackOutcome;
  let currentSession: string | undefined;
  try {
    callbackOutcome = await completeProviderCallback();
  } finally {
    // Record owned resources even when authorization or response delivery fails.
    currentSession = await captureSession();
  }
  const { file, ownedSocialRecords, sessionHash, stateHash } =
    await proveCallback(callbackOutcome, currentSession);
  await verifyReturnedPage();
  return {
    file,
    page,
    ownedSocialRecords,
    grant: {
      did: visitor,
      sessionHash: sessionHash!,
      callbackStateHash: stateHash,
      outcome: expectation === 'grant' ? 'authorized' : 'rejected',
    },
  };
  async function beginLogin() {
    let login: APIResponse | BrowserResponse;
    let loginPayload: { url: string } | undefined;
    if (startedInPage) {
      assert(!existingSession, 'The pending action must begin signed out.');
      await captureSocialLoading(
        page,
        dependencies.values.output!,
        `${filename.replace('.json', '')}-loading`,
        dependencies.ORIGIN + returnTo
      );
      await page
        .getByRole('button', {
          name: action === 'recommendation' ? 'Recommend' : 'Subscribe',
          exact: true,
        })
        .waitFor();
      await captureSocialState(
        page,
        dependencies.values.output!,
        `${filename.replace('.json', '')}-signed-out`
      );
      await page
        .getByRole('button', {
          name: action === 'recommendation' ? 'Recommend' : 'Subscribe',
          exact: true,
        })
        .click();
      await captureSocialState(
        page,
        dependencies.values.output!,
        `${filename.replace('.json', '')}-sign-in`
      );
      await page
        .getByLabel('Your handle', { exact: true })
        .fill('acceptance-invalid-handle');
      const invalidLogin = page.waitForResponse(
        (response) =>
          response.url() === `${dependencies.ORIGIN}/api/atproto/login` &&
          response.request().method() === 'POST'
      );
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      assert.equal((await invalidLogin).status(), 400);
      await page
        .getByRole('alert')
        .filter({ hasText: 'Check your handle and try again.' })
        .waitFor();
      await captureSocialState(
        page,
        dependencies.values.output!,
        `${filename.replace('.json', '')}-invalid-handle`
      );
      await page.getByLabel('Your handle', { exact: true }).fill(handle);
      const started = page.waitForResponse(
        (response) =>
          response.url() === `${dependencies.ORIGIN}/api/atproto/login` &&
          response.request().method() === 'POST'
      );
      void started.catch(() => {});
      let releaseLogin!: () => void;
      const heldLogin = new Promise<void>((done) => {
        releaseLogin = done;
      });
      let handlerStarted = false;
      let dispatched = false;
      let cancelled = false;
      let completed!: () => void;
      let failed!: (error: unknown) => void;
      const completion = new Promise<void>((done, reject) => {
        completed = done;
        failed = reject;
      });
      void completion.catch(() => {});
      const loginRoute = async (route: Route) => {
        handlerStarted = true;
        await heldLogin;
        try {
          if (cancelled) await route.abort('failed');
          else {
            const response = await route.fetch({
              timeout: 60000,
              maxRedirects: 0,
            });
            // Navigation discards Chromium's response body after fulfillment.
            loginPayload = (await response.json()) as { url: string };
            if (cancelled) await route.abort('failed');
            else await route.fulfill({ response });
          }
          completed();
        } catch (error) {
          await route.abort('failed').catch(() => {});
          failed(error);
        }
      };
      await page.route(`${dependencies.ORIGIN}/api/atproto/login`, loginRoute, {
        times: 1,
      });
      try {
        await page
          .getByRole('button', { name: 'Continue', exact: true })
          .click();
        await page
          .getByRole('button', { name: 'Connecting…', exact: true })
          .waitFor();
        await captureSocialState(
          page,
          dependencies.values.output!,
          `${filename.replace('.json', '')}-sign-in-pending`
        );
        dispatched = true;
        releaseLogin();
        await completion;
        login = await started;
      } catch (error) {
        await dependencies.recordOperationFailure(error).catch(() => {});
        throw error;
      } finally {
        if (!dispatched) cancelled = true;
        releaseLogin();
        // Disabling interception during the provider redirect can stall Chromium.
        // The one-use route removes itself after its handler completes.
        if (handlerStarted) await completion.catch(() => {});
      }
    } else
      login = await context.request.post(
        `${dependencies.ORIGIN}/api/atproto/login`,
        {
          headers: { origin: dependencies.ORIGIN },
          data: {
            handle,
            action,
            ...(action === 'recommendation' && {
              slug: dependencies.values.slug,
            }),
          },
        }
      );

    return { login, loginPayload };
  }
  async function bindIssuedState() {
    if ('finished' in login) assert.equal(await login.finished(), null);
    assert.equal(
      login.status(),
      200,
      'The deployed target must be verified before authorization begins.'
    );
    const flowCookie = await observedFlowCookie();
    if (dependencies.authorizationOnly)
      await dependencies.save('authorization-flow-cookie.json', {
        flowHash: dependencies.hash(flowCookie),
        visitor,
      });
    const rows = await dependencies.db
      .sql`SELECT key_hash, encrypted_value FROM atproto_oauth_states WHERE expires_at > NOW()`;
    const own = rows.rows.filter((row) => {
      const stored = dependencies.decryptOAuthValue<StoredState>(
        row.encrypted_value as string,
        dependencies.settings.ATPROTO_OAUTH_STORAGE_KEY
      );
      return (
        (stored.userState as { browserHash?: string })?.browserHash ===
        dependencies.hash(flowCookie)
      );
    });
    assert.equal(
      own.length,
      1,
      'Exactly one genuine provider authorization must belong to this browser flow.'
    );
    const issuedStateHash = own[0].key_hash as string;
    const issuedState = dependencies.decryptOAuthValue<StoredState>(
      own[0].encrypted_value as string,
      dependencies.settings.ATPROTO_OAUTH_STORAGE_KEY
    );
    if (dependencies.existingOnly) {
      assert(dependencies.authorizationBaseline);
      assert(
        !dependencies.authorizationBaseline.database.states.some(
          (row) => row.key === issuedStateHash
        )
      );
      dependencies.authorizationStates.push({
        key: issuedStateHash,
        did: visitor,
        encryptedHash: dependencies.hash(own[0].encrypted_value as string),
        flowHash: dependencies.hash(flowCookie),
      });
      await dependencies.save(
        'authorization-states.json',
        dependencies.authorizationStates
      );
    }
    const cookieDeadline = Date.now() + 5000;
    while (
      !(await context.cookies(dependencies.ORIGIN)).some(
        (entry) => entry.name === 'atproto_flow' && entry.value === flowCookie
      )
    ) {
      assert(
        Date.now() < cookieDeadline,
        'The actual login response cookie was not installed in its browser context.'
      );
      await new Promise((done) => setTimeout(done, 25));
    }
    const { url } = loginPayload ?? ((await login.json()) as { url: string });
    const intent = issuedState.userState as {
      action?: string;
      slug?: string;
      returnTo?: string;
    };
    assert.equal(intent.action, action);
    assert.equal(intent.returnTo, returnTo);
    assert.equal(
      intent.slug,
      action === 'recommendation' ? dependencies.values.slug : undefined
    );
    assert.equal(issuedState.sub, visitor);
    assert.equal(
      issuedState.redirectUri,
      `${dependencies.ORIGIN}/atproto/callback`
    );

    return { flowCookie, own, issuedStateHash, issuedState, url };
  }
  async function completeProviderCallback(): Promise<ProviderCallbackOutcome> {
    let response: BrowserResponse;
    let wrongBrowserRejected = false;
    const originalFlowCookie = (
      await context.cookies(dependencies.ORIGIN)
    ).find(
      (cookie) => cookie.name === 'atproto_flow' && cookie.value === flowCookie
    );
    assert(originalFlowCookie);
    if (expectation === 'grant')
      await context.addCookies([
        { ...originalFlowCookie, value: '0'.repeat(64) },
      ]);
    try {
      if (!startedInPage) await page.goto(url);
      else
        await page.waitForURL(
          (destination) => destination.origin === new URL(url).origin
        );
      if (automatedIdentity) {
        assert(ownedIdentities);
        await dependencies.authorizeOwnedProvider(
          page,
          automatedIdentity,
          ownedIdentities.origin,
          expectation
        );
      }
      response = await responsePromise;
      if (expectation === 'grant') {
        const rejectedCallback = new URL(response.url());
        assert(rejectedCallback.searchParams.has('code'));
        assert.equal(
          dependencies.hash(rejectedCallback.searchParams.get('state')!),
          issuedStateHash
        );
        assert.equal(response.status(), 303);
        const rejectedHeaders = await response.allHeaders();
        assert.equal(
          rejectedHeaders.location,
          dependencies.ORIGIN + '/writings?atprotoError=1'
        );
        assert(
          !(await response.headersArray()).some(
            (header) =>
              header.name.toLowerCase() === 'set-cookie' &&
              header.value.startsWith('atproto_session=')
          )
        );
        const retained = await dependencies.db
          .sql`SELECT encrypted_value FROM atproto_oauth_states WHERE key_hash = ${issuedStateHash}`;
        assert.equal(retained.rows.length, 1);
        assert.equal(
          dependencies.hash(retained.rows[0].encrypted_value as string),
          dependencies.hash(own[0].encrypted_value as string)
        );
        assert.equal(
          (
            await dependencies.db
              .sql`SELECT key_hash FROM atproto_oauth_sessions WHERE key_hash = ${dependencies.hash(visitor)}`
          ).rows.length,
          existingGrant.rows.length
        );
        assert.deepEqual(
          await dependencies.graphFor(visitor, action),
          beforeRecords
        );
        await page.waitForURL(
          (location) =>
            location.origin === dependencies.ORIGIN &&
            location.pathname === '/writings',
          { waitUntil: 'domcontentloaded', timeout: 60000 }
        );
        await context.addCookies([originalFlowCookie]);
        if (withholdDelivery) await withholdCallbackDelivery(rejectedCallback);
        const authorized = page.waitForResponse(
          (candidate) => candidate.url() === rejectedCallback.href,
          { timeout: 120000 }
        );
        void authorized.catch(() => {});
        await page.goto(rejectedCallback.href);
        response = await authorized;
        assert.equal(await response.finished(), null);
        await rememberCallback(response);
        wrongBrowserRejected = true;
      }
    } catch (error) {
      if (error !== dependencies.deliveryWithheld)
        await dependencies.recordOperationFailure(error).catch(() => {});
      throw error;
    }

    return { response, wrongBrowserRejected };
  }
  async function withholdCallbackDelivery(
    rejectedCallback: URL
  ): Promise<never> {
    assert(pendingGrant && !existingSession);
    let handlerStarted = false;
    let completed!: () => void;
    let failed!: (error: unknown) => void;
    const completion = new Promise<void>((done, reject) => {
      completed = done;
      failed = reject;
    });
    void completion.catch(() => {});
    const controller = new AbortController();
    const heldCallback = async (route: Route) => {
      handlerStarted = true;
      try {
        // route.fetch installs Set-Cookie before route.abort can withhold it.
        const upstream = await fetch(rejectedCallback.href, {
          redirect: 'manual',
          headers: { cookie: `atproto_flow=${flowCookie}` },
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(60000),
          ]),
        });
        await upstream.arrayBuffer();
        await rememberCallback({
          status: () => upstream.status,
          headersArray: async () =>
            upstream.headers
              .getSetCookie()
              .map((value) => ({ name: 'set-cookie', value })),
        });
        assert.equal(upstream.status, 303);
        assert.equal(
          upstream.headers.get('location'),
          dependencies.ORIGIN + returnTo
        );
        assert(pendingGrant!.responseSessionHash);
        await route.abort('failed');
        completed();
      } catch (error) {
        await route.abort('failed').catch(() => {});
        failed(error);
      }
    };
    await page.route(rejectedCallback.href, heldCallback, { times: 1 });
    try {
      await page.goto(rejectedCallback.href, { timeout: 70000 }).then(
        () => {
          throw new Error('The callback response reached the browser.');
        },
        (error: Error) => {
          assert.match(error.message, /ERR_FAILED/);
        }
      );
      await completion;
    } finally {
      controller.abort();
      if (handlerStarted) await completion.catch(() => {});
      await page.unroute(rejectedCallback.href, heldCallback);
    }
    assert(
      !(await context.cookies(dependencies.ORIGIN)).some(
        (cookie) => cookie.name === 'atproto_session'
      )
    );
    assert.equal(
      (
        await (
          await context.request.get(`${dependencies.ORIGIN}/api/atproto/social`)
        ).json()
      ).signedIn,
      false
    );
    const { withOAuthLock } =
      await import('../../../../../lib/atproto/oauth-storage');
    await withOAuthLock(`oauth-session-${visitor}`, async () => {
      const current = await dependencies.db
        .sql`SELECT encrypted_value FROM atproto_oauth_sessions WHERE key_hash = ${dependencies.hash(visitor)}`;
      assert.equal(
        current.rows.length,
        1,
        'The real callback must have stored its new provider grant before browser delivery was lost.'
      );
      dependencies.assertGrantBinding(
        pendingGrant!,
        dependencies.decryptOAuthValue<StoredSession>(
          current.rows[0].encrypted_value as string,
          dependencies.settings.ATPROTO_OAUTH_STORAGE_KEY
        )
      );
      await dependencies.recoverPendingGrant(pendingGrant!);
    });
    assert.equal((await dependencies.graphFor(visitor, action)).length, 1);
    assert.equal(
      (
        await dependencies.db
          .sql`SELECT key_hash FROM atproto_oauth_states WHERE key_hash = ${issuedStateHash}`
      ).rows.length,
      0
    );
    await page.goto(dependencies.ORIGIN + returnTo);
    await page
      .getByRole('button', { name: 'Subscribe', exact: true })
      .waitFor();
    await captureSocialState(
      page,
      dependencies.values.output!,
      'callback-delivery-withheld'
    );
    dependencies.deliveryFailureObserved = true;
    await dependencies.save('cookie-delivery-receipt.json', {
      status: 'observed',
      scope: 'real-callback-browser-delivery-failure',
      probeSourceFiles: await captureSourceManifest(),
      probeSourceSha256: dependencies.hash(
        await readFile(entrypointPath('atproto-social-capture.mts'), 'utf8')
      ),
      runtimeRevision: dependencies.authorizationRevision,
      localVerifier: dependencies.localVerifier,
      fullVerification: 'pending',
      did: visitor,
      stateHash: issuedStateHash,
      dpopSpkiSha256: pendingGrant.dpopSpkiSha256,
      actualCallbackStatus: 303,
      browserSessionAbsent: true,
      providerGrantBoundToIssuedState: true,
      browserRowBoundToActualResponse: true,
      actualSubscriptionPresent: true,
    });
    throw dependencies.deliveryWithheld;
  }
  async function proveCallback(
    { response, wrongBrowserRejected }: ProviderCallbackOutcome,
    currentSession: string | undefined
  ) {
    const callback = new URL(response.url());
    const headers = await response.allHeaders();
    assert.equal(response.status(), 303);
    const location = headers.location;
    assert(location?.startsWith(dependencies.ORIGIN));
    const status = await context.request.get(
      `${dependencies.ORIGIN}/api/atproto/social`
    );
    assert.equal(status.status(), 200);
    await verifyCallbackOutcome();
    const ownedSocialRecords = await observeCallbackRecords();
    if (sessionsBefore) {
      assert(
        !(await context.cookies(dependencies.ORIGIN)).some(
          (entry) => entry.name === 'atproto_session'
        )
      );
      const signedOutStatus = await context.request.get(
        `${dependencies.ORIGIN}/api/atproto/social`
      );
      assert.equal(signedOutStatus.status(), 200);
      assert.equal((await signedOutStatus.json()).signedIn, false);
      assert.deepEqual(
        (
          await dependencies.db
            .sql`SELECT token_hash FROM atproto_browser_sessions WHERE did = ${visitor}`
        ).rows
          .map((row) => row.token_hash)
          .sort(),
        sessionsBefore
      );
    }
    // A signed hash of the observed absent cookie denotes no session. It is never accepted as an authenticated session.
    const sessionHash = dependencies.hash(currentSession ?? '');
    const stateHash = dependencies.hash(callback.searchParams.get('state')!);
    assert.equal(
      stateHash,
      issuedStateHash,
      'The observed callback must belong to the actual issued state.'
    );
    if (callback.searchParams.has('iss'))
      assert.equal(callback.searchParams.get('iss'), issuedState.issuer);
    if (expectation === 'grant') {
      const session = await dependencies.db
        .sql`SELECT did FROM atproto_browser_sessions WHERE token_hash = ${sessionHash!} AND expires_at > NOW()`;
      assert.equal(session.rows.length, 1);
      assert.equal(session.rows[0].did, visitor);
      assert.equal(ownedSocialRecords.length, 1);
      assert.equal(
        (
          await dependencies.db
            .sql`SELECT key_hash FROM atproto_oauth_states WHERE key_hash = ${stateHash}`
        ).rows.length,
        0
      );
    }
    const proof = {
      visitor,
      sessionHash: sessionHash!,
      stateHash,
      issuedStateHash,
      issuedStateExpiresAt: issuedState.expiresAt,
      issuedStateIssuer: issuedState.issuer,
      outcome:
        expectation === 'grant'
          ? ('authorized' as const)
          : ('rejected' as const),
      url: callback.href,
      flowCookie,
      status: response.status(),
      location,
      wrongBrowserRejected,
      expectation,
      sessionReplaced: currentSession !== existingSession,
      ...(expectation === 'expired' && {
        expirySource:
          'Only this genuine authorization state database deadline was moved into the past; the provider code was real.',
      }),
    };
    const file = await dependencies.save(filename, {
      ...proof,
      signature: callbackSignature(
        proof,
        dependencies.settings.ATPROTO_OAUTH_STORAGE_KEY
      ),
      ownedSocialRecords,
      observedAt: new Date().toISOString(),
      ...(sessionsBefore && {
        absentSession: {
          cookieBefore: false,
          cookieAfter: false,
          databaseSessionInventoryUnchanged: true,
        },
      }),
    });
    if (expiredKey)
      await dependencies.db
        .sql`DELETE FROM atproto_oauth_states WHERE key_hash = ${expiredKey}`;

    return { file, ownedSocialRecords, sessionHash, stateHash };
    async function verifyCallbackOutcome(): Promise<void> {
      if (expectation === 'grant') {
        assert(callback.searchParams.has('code'));
        assert.equal(location, dependencies.ORIGIN + returnTo);
        assert(currentSession && currentSession !== existingSession);
        assert((await status.json()).signedIn);
        assert(
          wrongBrowserRejected,
          'Wrong-browser binding rejection was not exercised.'
        );
      } else {
        assert(location.includes('atprotoError=1'));
        assert(
          currentSession === existingSession,
          'A failed authorization cannot issue or replace a session.'
        );
        if (expectation === 'cancel')
          assert.equal(callback.searchParams.get('error'), 'access_denied');
        else
          assert(
            callback.searchParams.has('code'),
            'Expired-state proof requires a real code from the provider.'
          );
      }
    }
    async function observeCallbackRecords() {
      const ownedSocialRecords =
        expectation === 'grant'
          ? (await dependencies.graphFor(visitor, action)).map((record) => ({
              uri: record.uri,
              cid: record.cid,
              kind: action,
              target:
                record.value[
                  action === 'subscription' ? 'publication' : 'document'
                ],
            }))
          : [];
      const owner = dependencies.ownership.find(
        (entry) =>
          entry.sessionHash ===
          (currentSession ? dependencies.hash(currentSession) : undefined)
      );
      if (owner && expectation === 'grant') {
        owner.records = ownedSocialRecords.map((record) => ({
          ...record,
          kind: action,
          target: record.target as string,
        }));
        owner.inventoryComplete = true;
        await dependencies.journalOwnership();
      }
      if (expectation !== 'grant')
        assert.deepEqual(
          await dependencies.graphFor(visitor, action),
          beforeRecords
        );

      return ownedSocialRecords;
    }
  }
  async function verifyReturnedPage(): Promise<void> {
    await page.waitForURL(`${dependencies.ORIGIN}${returnTo}**`);
    assert.equal(new URL(page.url()).pathname, returnTo);
    if (expectation === 'grant' && action === 'recommendation')
      await page
        .getByRole('button', { name: 'Recommended', exact: true })
        .waitFor({ state: 'visible' });
    if (expectation === 'grant' && dependencies.authorizationOnly)
      await page
        .getByRole('button', { name: 'Subscribed', exact: true })
        .waitFor({ state: 'visible' });
    await page
      .locator(`[data-standard-social="${action}"]`)
      .waitFor({ state: 'visible' });
    await captureSocialState(
      page,
      dependencies.values.output!,
      `${filename.replace('.json', '')}-returned`
    );
  }
  async function prepareOwnedProvider() {
    const automatedIdentity = ownedIdentities
      ? [ownedIdentities.publisher, ownedIdentities!.visitor].find(
          (identity) => identity.handle === handle
        )
      : undefined;
    if (ownedIdentities) {
      assert(
        automatedIdentity,
        'Only journaled handles may use generated credentials.'
      );
      assert.equal(automatedIdentity.did, visitor);
      if (expectation === 'cancel')
        await context.clearCookies({
          domain: new URL(ownedIdentities.origin).hostname,
        });
    }

    return automatedIdentity;
  }
  async function observeFlowStart() {
    const existingSession = (await context.cookies(dependencies.ORIGIN)).find(
      (entry) => entry.name === 'atproto_session'
    )?.value;
    const returnTo =
      action === 'recommendation'
        ? `/writings/${dependencies.values.slug}`
        : '/writings';
    const startedInPage =
      (expectation === 'grant' &&
        (action === 'recommendation' || dependencies.authorizationOnly)) ||
      (expectation === 'cancel' && !existingSession);
    const sessionsBefore =
      expectation === 'cancel' && !existingSession
        ? (
            await dependencies.db
              .sql`SELECT token_hash FROM atproto_browser_sessions WHERE did = ${visitor}`
          ).rows
            .map((row) => row.token_hash)
            .sort()
        : undefined;

    return { existingSession, returnTo, startedInPage, sessionsBefore };
  }
  async function journalPendingGrant() {
    let pendingGrant: PendingGrant | undefined;
    if (
      withholdDelivery &&
      expectation === 'grant' &&
      existingGrant.rows.length === 0 &&
      ownedIdentities
    ) {
      const { resolvePds } =
        await import('../../../../../lib/atproto/identity');
      pendingGrant = {
        did: visitor,
        stateHash: issuedStateHash,
        flowHash: dependencies.hash(flowCookie),
        encryptedStateHash: dependencies.hash(own[0].encrypted_value as string),
        dpopSpkiSha256: dependencies.publicDpopHash(issuedState.dpopKey),
        issuer: issuedState.issuer,
        audience: new URL(await resolvePds(visitor as Did)).href,
        kind: action,
        beforeRecords: beforeRecords.map(({ uri, cid }) => ({ uri, cid })),
        beforeBrowsers: (
          await dependencies.db
            .sql`SELECT token_hash FROM atproto_browser_sessions WHERE did = ${visitor}`
        ).rows.map((row) => row.token_hash as string),
        priorGrantKeys: existingGrant.rows.map((row) => row.key_hash as string),
      };
      dependencies.pendingGrants.push(pendingGrant);
      // The SDK carries this exact DPoP key from state into its stored grant.
      await dependencies.journalPendingGrants();
    }

    return pendingGrant;
  }
  function explainManualProviderStep(): void {
    if (!automatedIdentity)
      console.log(
        expectation === 'cancel'
          ? 'Decline this authorization in the provider browser. Do not approve it.'
          : expectation === 'expired'
            ? 'Approve this already expired test authorization. The site must reject its callback.'
            : 'Sign in with this acceptance account and approve the site request in the browser.'
      );
  }
  async function observedFlowCookie(): Promise<string> {
    const issuedCookie = (await login.headersArray())
      .find(
        (entry) =>
          entry.name.toLowerCase() === 'set-cookie' &&
          entry.value.startsWith('atproto_flow=')
      )
      ?.value.match(/^atproto_flow=([a-f0-9]{64})(?:;|$)/)?.[1];
    const flowCookie =
      issuedCookie ??
      (await context.cookies(dependencies.ORIGIN)).find(
        (entry) => entry.name === 'atproto_flow'
      )?.value;
    assert(flowCookie && /^[a-f0-9]{64}$/.test(flowCookie));

    return flowCookie;
  }
}
