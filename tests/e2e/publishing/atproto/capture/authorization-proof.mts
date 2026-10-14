import type {} from '@atcute/atproto';
import type { Did } from '@atcute/lexicons';
import type { StoredSession } from '@atcute/oauth-node-client';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import {
  type CapturedCallback,
  verifyCallbackSignature,
} from '../../../../support/publishing/callback-proof.mts';
import { captureSocialState } from '../../../../support/publishing/social-browser.mts';
import type { AuthorizationBaseline } from './types.mts';

interface Context {
  flow: (
    context: import('@playwright/test').BrowserContext,
    handle: string,
    expectation: 'grant' | 'cancel' | 'expired',
    filename: string,
    action?: 'subscription' | 'recommendation',
    withholdDelivery?: boolean
  ) => Promise<{
    file: string;
    page: import('@playwright/test').Page;
    ownedSocialRecords: {
      uri: string;
      cid: string;
      kind: 'subscription' | 'recommendation';
      target: unknown;
    }[];
    grant: {
      did: string;
      sessionHash: string;
      callbackStateHash: string;
      outcome: string;
    };
  }>;
  existingRuntime:
    | {
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
    | undefined;
  localVerifier:
    | {
        revision: string;
        sourceHashes: Record<string, string>;
        deployedCode: boolean;
      }
    | undefined;
  authorizationBaseline: AuthorizationBaseline | undefined;
  save: (name: string, value: unknown) => Promise<string>;
  first: import('@playwright/test').BrowserContext;
  second: import('@playwright/test').BrowserContext;
  ORIGIN: string;
  hash: (value: string) => string;
  db: import('@vercel/postgres').VercelPool;
  decryptOAuthValue: <T>(value: string, key: string) => T;
  settings: Record<string, string>;
  graphFor: (
    did: string,
    action?: 'subscription' | 'recommendation',
    targetOnly?: boolean
  ) => Promise<{ uri: string; cid: string; value: Record<string, unknown> }[]>;
  databaseInventory: (
    pool?: import('@vercel/postgres').VercelPool
  ) => Promise<{ [k: string]: { key: string; rowHash: string }[] }>;
  visitorGraphs: () => Promise<
    { uri: string; cid: string; value: Record<string, unknown> }[]
  >;
  root: string;
  values: {
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
  };
  env: NodeJS.ProcessEnv;
  verifyExistingRuntime: () => Promise<{
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
  }>;
  verifierHashes: () => Promise<Record<string, string>>;
}

export async function verifyAuthorizationOnly(
  dependencies: Context,
  granted: Awaited<ReturnType<typeof dependencies.flow>>,
  grantedSecond: Awaited<ReturnType<typeof dependencies.flow>>,
  cancelled: Awaited<ReturnType<typeof dependencies.flow>>,
  expired: Awaited<ReturnType<typeof dependencies.flow>>,
  signedOutCancellation: Awaited<ReturnType<typeof dependencies.flow>>
) {
  assert(
    dependencies.existingRuntime &&
      dependencies.localVerifier &&
      dependencies.authorizationBaseline
  );
  const receipt = {
    scope: 'atproto-authorization-and-subscription',
    started: new Date().toISOString(),
    runtime: dependencies.existingRuntime,
    localVerifier: dependencies.localVerifier,
    status: 'running',
    fullVerification: 'pending',
    pending: [
      'Recommendation writes, undo and failure states require a published disposable writing.',
      'The complete social failure, expired-browser-session and lost-response suite remains pending.',
      'Hosted Atmosphere response rendering and the full combined verification remain pending.',
    ],
    checks: [] as { name: string; details?: unknown }[],
  };
  const receiptName = 'authorization-receipt.json';
  async function checked(name: string, details?: unknown) {
    receipt.checks.push({ name, details });
    await dependencies.save(receiptName, receipt);
    console.log(`Passed: ${name}.`);
  }
  await dependencies.save(receiptName, receipt);
  const contexts = [dependencies.first, dependencies.second];
  const grants = [granted, grantedSecond];
  const visitors: string[] = [];
  for (const [index, result] of grants.entries()) {
    const cookies = await contexts[index].cookies(dependencies.ORIGIN);
    const cookie = cookies.find((entry) => entry.name === 'atproto_session');
    assert(cookie && /^[a-f0-9]{64}$/.test(cookie.value));
    assert(cookie.secure && cookie.httpOnly && cookie.sameSite === 'Lax');
    assert.equal(cookie.path, '/');
    assert.equal(
      cookie.domain.replace(/^\./, ''),
      new URL(dependencies.ORIGIN).hostname
    );
    assert.equal(dependencies.hash(cookie.value), result.grant.sessionHash);
    const browserRow = await dependencies.db
      .sql`SELECT did FROM atproto_browser_sessions WHERE token_hash = ${dependencies.hash(cookie.value)} AND expires_at > NOW()`;
    assert.equal(browserRow.rows.length, 1);
    assert.equal(browserRow.rows[0].did, result.grant.did);
    visitors.push(result.grant.did);
    const stored = await dependencies.db
      .sql`SELECT encrypted_value FROM atproto_oauth_sessions WHERE key_hash = ${dependencies.hash(result.grant.did)} AND expires_at > NOW()`;
    assert.equal(stored.rows.length, 1);
    const tokens = dependencies.decryptOAuthValue<StoredSession>(
      stored.rows[0].encrypted_value as string,
      dependencies.settings.ATPROTO_OAUTH_STORAGE_KEY
    ).tokenSet;
    assert.equal(tokens.sub, result.grant.did);
    assert.equal(tokens.token_type, 'DPoP');
    assert.equal(
      tokens.iss,
      dependencies.settings.ATPROTO_ACCEPTANCE_PROVIDER_ORIGIN
    );
    const { resolvePds } = await import('../../../../../lib/atproto/identity');
    assert.equal(
      new URL(tokens.aud).href,
      new URL(await resolvePds(result.grant.did as Did)).href
    );
    assert(tokens.scope.split(/\s+/).includes('atproto'));
    const scopes = tokens.scope.split(/\s+/);
    const graphScope = scopes.find((scope) => scope.startsWith('repo?'));
    const grantedCollections = graphScope
      ? new URLSearchParams(graphScope.slice('repo?'.length))
          .getAll('collection')
          .sort()
      : [];
    assert(
      scopes.includes('include:site.standard.authSocial') ||
        JSON.stringify(grantedCollections) ===
          JSON.stringify([
            'site.standard.graph.recommend',
            'site.standard.graph.subscription',
          ]),
      'The provider must grant both Standard.site social collections.'
    );
    const records = await dependencies.graphFor(result.grant.did);
    assert.equal(records.length, 1);
    assert.equal(records[0].uri, result.ownedSocialRecords[0].uri);
    assert.equal(records[0].cid, result.ownedSocialRecords[0].cid);
    const state = await contexts[index].request.get(
      `${dependencies.ORIGIN}/api/atproto/social`
    );
    assert.equal(state.status(), 200);
    const status = await state.json();
    assert(
      status.enabled && status.ready && status.signedIn && status.subscribed
    );
    await checked(
      'Normal Subscribe UI authorization creates the expected visitor subscription and real DPoP grant',
      {
        visitor: result.grant.did,
        uri: records[0].uri,
        cid: records[0].cid,
        issuer: tokens.iss,
        audience: tokens.aud,
        scope: tokens.scope,
      }
    );
  }
  assert.notEqual(visitors[0], visitors[1]);
  assert.notEqual(granted.grant.sessionHash, grantedSecond.grant.sessionHash);
  const metadata = await fetch(
    `${dependencies.ORIGIN}/oauth-client-metadata.json`,
    {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    }
  );
  assert.equal(metadata.status, 200);
  assert.equal(
    (await metadata.json()).scope,
    'atproto include:site.standard.authSocial'
  );
  for (const result of [
    granted,
    grantedSecond,
    cancelled,
    expired,
    signedOutCancellation,
  ]) {
    const proof = JSON.parse(
      await readFile(result.file, 'utf8')
    ) as CapturedCallback;
    verifyCallbackSignature(
      proof,
      dependencies.settings.ATPROTO_OAUTH_STORAGE_KEY
    );
    assert.equal(proof.visitor, result.grant.did);
    assert.equal(proof.sessionHash, result.grant.sessionHash);
    assert.equal(
      (
        await dependencies.db
          .sql`SELECT key_hash FROM atproto_oauth_states WHERE key_hash = ${proof.stateHash}`
      ).rows.length,
      0
    );
    await checked(
      'The genuine provider flow passes its callback, browser-binding, session and graph assertions',
      {
        visitor: proof.visitor,
        expectation: proof.expectation,
        outcome: proof.outcome,
        stateHash: proof.stateHash,
        wrongBrowserRejected: proof.wrongBrowserRejected,
        sessionCookie: result === signedOutCancellation ? 'absent' : 'present',
        expirySource: proof.expirySource,
      }
    );
  }
  const proof = JSON.parse(
    await readFile(granted.file, 'utf8')
  ) as CapturedCallback;
  const beforeDatabase = await dependencies.databaseInventory();
  const beforeGraphs = await dependencies.visitorGraphs();
  const replay = await fetch(proof.url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(60000),
    headers: { cookie: `atproto_flow=${proof.flowCookie}` },
  });
  assert.equal(replay.status, 303);
  assert.equal(
    replay.headers.get('location'),
    dependencies.ORIGIN + '/writings?atprotoError=1'
  );
  assert(
    !replay.headers
      .getSetCookie()
      .some((entry) => entry.startsWith('atproto_session='))
  );
  assert.deepEqual(await dependencies.databaseInventory(), beforeDatabase);
  assert.deepEqual(await dependencies.visitorGraphs(), beforeGraphs);
  await checked(
    'The consumed real grant callback rejects replay without changing either visitor graph or database inventory'
  );
  async function refreshInstance() {
    return new Promise<Record<string, unknown>>((finish, reject) => {
      let stdout = '';
      let timedOut = false;
      const child = spawn(
        process.execPath,
        [
          resolve(dependencies.root, 'node_modules/tsx/dist/cli.mjs'),
          resolve(dependencies.root, 'scripts/atproto-refresh-acceptance.mts'),
          '--env',
          resolve(dependencies.values.env!),
          '--visitor',
          visitors[0],
        ],
        {
          cwd: dependencies.root,
          env: dependencies.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        }
      );
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', () => {});
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, 120000);
      const killTimeout = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, 125000);
      child.on('error', (error) => {
        clearTimeout(timeout);
        clearTimeout(killTimeout);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timeout);
        clearTimeout(killTimeout);
        if (timedOut || code !== 0)
          return reject(
            new Error(
              'A real refresh process failed or exceeded its deadline; credentials remain private.'
            )
          );
        try {
          const result = JSON.parse(stdout.trim()) as Record<string, unknown>;
          assert.equal(result.status, 'passed');
          assert.equal(result.visitor, visitors[0]);
          assert(
            result.providerRefresh &&
              result.authenticatedPdsRead &&
              result.accessGenerationChanged
          );
          finish(result);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
  const refreshes = await Promise.allSettled([
    refreshInstance(),
    refreshInstance(),
  ]);
  const instances = refreshes.map((result) => {
    if (result.status === 'rejected') throw result.reason;
    return result.value;
  });
  assert.notEqual(instances[0].pid, instances[1].pid);
  await checked(
    'Two independent processes force real provider refresh and authenticate a PDS read under distributed locks',
    { instances, forcedRefresh: true, naturalExpiry: false }
  );
  const secondBefore = await dependencies.visitorGraphs();
  const undo = await dependencies.first.request.delete(
    `${dependencies.ORIGIN}/api/atproto/subscription`,
    { headers: { origin: dependencies.ORIGIN }, data: {} }
  );
  assert.equal(undo.status(), 200);
  assert.equal((await undo.json()).active, false);
  assert.equal((await dependencies.graphFor(visitors[0])).length, 0);
  assert.deepEqual(
    (await dependencies.visitorGraphs()).filter((record) =>
      record.uri.startsWith(`at://${visitors[1]}/`)
    ),
    secondBefore.filter((record) =>
      record.uri.startsWith(`at://${visitors[1]}/`)
    )
  );
  const secondStatus = await dependencies.second.request.get(
    `${dependencies.ORIGIN}/api/atproto/social`
  );
  assert.equal(secondStatus.status(), 200);
  assert((await secondStatus.json()).subscribed);
  await checked(
    'Primary subscription undo is confirmed on its real PDS and preserves the second visitor graph'
  );
  for (const [index, context] of contexts.entries()) {
    if (index === 1) {
      const response = await context.request.delete(
        `${dependencies.ORIGIN}/api/atproto/subscription`,
        { headers: { origin: dependencies.ORIGIN }, data: {} }
      );
      assert.equal(response.status(), 200);
      assert.equal((await response.json()).active, false);
      assert.equal((await dependencies.graphFor(visitors[index])).length, 0);
    }
    await grants[index].page.reload();
    await grants[index].page
      .getByRole('button', { name: 'Subscribe', exact: true })
      .waitFor();
    await captureSocialState(
      grants[index].page,
      dependencies.values.output!,
      `subscription-undone-${index + 1}`
    );
    const ended = await context.request.post(
      `${dependencies.ORIGIN}/api/atproto/logout`,
      {
        headers: { origin: dependencies.ORIGIN },
        data: {},
      }
    );
    assert.equal(ended.status(), 200);
    assert(
      !(await context.cookies(dependencies.ORIGIN)).some(
        (cookie) => cookie.name === 'atproto_session'
      )
    );
    const status = await context.request.get(
      `${dependencies.ORIGIN}/api/atproto/social`
    );
    assert.equal(status.status(), 200);
    assert.equal((await status.json()).signedIn, false);
    if (index === 0) {
      const isolated = await dependencies.second.request.get(
        `${dependencies.ORIGIN}/api/atproto/social`
      );
      assert.equal(isolated.status(), 200);
      const other = await isolated.json();
      assert(other.signedIn && other.subscribed);
    }
    await grants[index].page.reload();
    await grants[index].page
      .getByRole('button', { name: 'Subscribe', exact: true })
      .waitFor();
    await captureSocialState(
      grants[index].page,
      dependencies.values.output!,
      `signed-out-subscription-${index + 1}`
    );
  }
  assert.deepEqual(
    await dependencies.visitorGraphs(),
    dependencies.authorizationBaseline.graphs
  );
  assert.deepEqual(
    await dependencies.verifyExistingRuntime(),
    dependencies.existingRuntime
  );
  assert.deepEqual(
    await dependencies.verifierHashes(),
    dependencies.localVerifier.sourceHashes
  );
  await checked(
    'Both real subscriptions are undone and isolated browser sign-out preserves the other account'
  );
  receipt.status = 'passed';
  await dependencies.save(receiptName, receipt);
  console.log(
    'Limited authorization and subscription checks passed. Recommendations, hosted rendering and full verification remain pending. Exact owned cleanup follows.'
  );
}
