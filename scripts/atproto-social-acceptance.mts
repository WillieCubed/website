import type { Did } from '@atcute/lexicons';
import type { StoredSession } from '@atcute/oauth-node-client';
import { now } from '@atcute/tid';
import { chromium } from '@playwright/test';
import { createPool } from '@vercel/postgres';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';

import type { RepoClient } from '../lib/atproto/types';
import {
  type CapturedCallback,
  verifyCallbackSignature,
} from './atproto-callback-proof.mts';
import { captureSocialState } from './atproto-social-failures.mts';

async function main() {
  const ORIGIN = 'https://indieweb-acceptance.vercel.app';
  const OWNER = 'did:plc:iyn6nc3ffqm2e3555exyrgvv';
  const { values } = parseArgs({
    options: {
      env: { type: 'string', default: '.env.standard-test.local' },
      receipt: {
        type: 'string',
        default: `.playwright-mcp/atproto-social-live-${Date.now()}.json`,
      },
      'cookie-file': { type: 'string' },
      'second-cookie-file': { type: 'string' },
      'callback-file': { type: 'string' },
      'cancelled-callback-file': { type: 'string' },
      'signed-out-cancelled-callback-file': { type: 'string' },
      'expired-callback-file': { type: 'string' },
      'refresh-wait-seconds': { type: 'string', default: '0' },
      slug: { type: 'string' },
      write: { type: 'boolean', default: false },
    },
  });
  try {
    Object.assign(process.env, parseEnv(await readFile(values.env!, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (process.env.POSTGRES_URL) {
    const dbUrl = new URL(process.env.POSTGRES_URL);
    assert(
      /^ep-winter-wind-b5iiaxe7(?:-pooler)?\.c-7\.us-east-2\.aws\.neon\.tech$/.test(
        dbUrl.hostname
      ),
      'Only the verified isolated acceptance Neon host is permitted.'
    );
  }
  assert(
    process.env.NEXT_PUBLIC_ATPROTO_DID &&
      process.env.NEXT_PUBLIC_ATPROTO_DID !== OWNER,
    'Configure a separate acceptance publisher first. The production owner is forbidden.'
  );
  assert.equal(process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, ''), ORIGIN);
  assert(
    process.env.POSTGRES_URL,
    'Load the isolated acceptance database URL through --env.'
  );
  assert(
    values.slug && /^[a-z0-9][a-z0-9-]{0,199}$/.test(values.slug),
    'Choose an existing published acceptance writing with --slug.'
  );
  const refreshSeconds = Number(values['refresh-wait-seconds']);
  assert(
    Number.isInteger(refreshSeconds) &&
      refreshSeconds >= 0 &&
      refreshSeconds <= 3600,
    '--refresh-wait-seconds must be between 0 and 3600.'
  );

  interface OwnedSocialRecord {
    uri: string;
    cid: string;
    kind: 'subscription' | 'recommendation';
    target: string;
  }
  interface CookieExport {
    cookies?: BrowserCookie[];
    ownedSocialRecords?: OwnedSocialRecord[];
    grant?: {
      did: string;
      sessionHash: string;
      callbackStateHash: string;
      outcome: string;
    };
  }
  interface BrowserCookie {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: string;
    expires?: number;
  }
  async function sessionCookie(path: string | undefined) {
    assert(
      path,
      'Export an already authorized browser cookie jar with --cookie-file and --second-cookie-file. The runner never manufactures a grant.'
    );
    const json = JSON.parse(await readFile(path, 'utf8')) as
      | CookieExport
      | BrowserCookie[];
    const cookies = Array.isArray(json) ? json : json.cookies;
    assert(
      Array.isArray(cookies),
      'Cookie export must contain a cookies array.'
    );
    const cookie = cookies.find(
      (entry) =>
        entry.name === 'atproto_session' &&
        entry.domain?.replace(/^\./, '') === new URL(ORIGIN).hostname
    );
    assert(
      cookie && /^[a-f0-9]{64}$/.test(cookie.value),
      'An opaque acceptance browser-session cookie is required.'
    );
    assert(
      cookie.secure && cookie.httpOnly && cookie.sameSite === 'Lax',
      'The exported session cookie must be Secure, HttpOnly and SameSite=Lax.'
    );
    assert(cookie.domain && cookie.path === '/');
    return {
      browserCookie: {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: 'Lax' as const,
        ...(cookie.expires !== undefined && { expires: cookie.expires }),
      },
      value: cookie.value,
      owned: Array.isArray(json) ? [] : (json.ownedSocialRecords ?? []),
      grant: Array.isArray(json) ? undefined : json.grant,
    };
  }
  const primaryExport = await sessionCookie(values['cookie-file']);
  const secondExport = await sessionCookie(values['second-cookie-file']);
  const primaryCookie = primaryExport.value;
  const secondCookie = secondExport.value;
  assert(
    primaryCookie !== secondCookie,
    'Browser isolation requires two distinct real sessions.'
  );
  const digest = (value: string) =>
    createHash('sha256').update(value).digest('hex');
  const database = createPool({ max: 2 });
  async function browserDid(cookie: string) {
    const row =
      await database.sql`SELECT did FROM atproto_browser_sessions WHERE token_hash = ${digest(cookie)} AND expires_at > NOW()`;
    assert.equal(
      row.rows.length,
      1,
      'The cookie must identify an unexpired real browser session.'
    );
    const did = row.rows[0].did as string;
    assert(
      did !== OWNER && /^did:(plc|web):/.test(did),
      'A production-owner visitor session is forbidden.'
    );
    const granted =
      await database.sql`SELECT key_hash FROM atproto_oauth_sessions WHERE key_hash = ${digest(did)} AND expires_at > NOW()`;
    assert.equal(
      granted.rows.length,
      1,
      'The provider grant must already exist on the server.'
    );
    return did;
  }
  let receipt: {
    started: string;
    publisher: string;
    visitor: string;
    secondVisitor: string;
    target: string;
    checks: { name: string; observedAt: string; details?: unknown }[];
    pending: string[];
    owned: OwnedSocialRecord[];
    cleanup: 'pending' | 'passed' | 'failed';
    error?: string;
  };
  async function save() {
    await mkdir(dirname(values.receipt!), { recursive: true });
    await writeFile(values.receipt!, JSON.stringify(receipt, null, 2) + '\n', {
      mode: 0o600,
    });
    await chmod(values.receipt!, 0o600);
  }
  async function checked(name: string, details?: unknown) {
    receipt.checks.push({
      name,
      observedAt: new Date().toISOString(),
      details,
    });
    await save();
    console.log(`Passed: ${name}.`);
  }
  interface Status {
    enabled: boolean;
    ready?: boolean;
    signedIn: boolean;
    subscribed?: boolean;
    recommended?: boolean;
  }
  async function request(
    path: string,
    method = 'GET',
    cookie = primaryCookie,
    body?: unknown,
    origin = ORIGIN
  ) {
    return fetch(ORIGIN + path, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(60000),
      headers: {
        ...(cookie && { cookie: `atproto_session=${cookie}` }),
        ...(method !== 'GET' && { origin, 'content-type': 'application/json' }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  }
  async function status(cookie = primaryCookie): Promise<Status> {
    const response = await request(
      `/api/atproto/social?slug=${values.slug}`,
      'GET',
      cookie
    );
    assert.equal(
      response.status,
      200,
      'Social status must succeed against the real deployment.'
    );
    return response.json();
  }
  async function writeRequest(
    path: string,
    method: 'PUT' | 'DELETE',
    body: unknown
  ): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const response = await request(path, method, primaryCookie, body);
      if (response.status === 429 && attempt < 2) {
        await response.body?.cancel();
        console.log(
          'The server rate limit is active. Wait for its minute window before retrying.'
        );
        await new Promise((resolve) => setTimeout(resolve, 55000));
        await new Promise((resolve) => setTimeout(resolve, 6000));
        continue;
      }
      return response;
    }
  }
  async function mutate(
    kind: 'subscription' | 'recommendation',
    method: 'PUT' | 'DELETE'
  ) {
    const response = await writeRequest(
      `/api/atproto/${kind}`,
      method,
      kind === 'recommendation' ? { slug: values.slug } : {}
    );
    assert.equal(
      response.status,
      200,
      `Real ${kind} ${method} failed (${response.status}).`
    );
    const result = (await response.json()) as { active: boolean };
    assert.equal(result.active, method === 'PUT');
  }

  let externalClient: RepoClient | undefined;
  try {
    const visitor = await browserDid(primaryCookie);
    const secondVisitor = await browserDid(secondCookie);
    assert.notEqual(
      visitor,
      secondVisitor,
      'Account isolation requires two separate acceptance visitor accounts.'
    );
    console.log(
      `Step 1: Verify existing provider grants for ${visitor} and ${secondVisitor}.`
    );
    const { publishingIdentity } = await import('../lib/atproto/config');
    const { resolvePds } = await import('../lib/atproto/identity');
    const { documentRkey } = await import('../lib/atproto/keys');
    const { loadWriting, getWritingSlugs } = await import('../lib/writings');
    const { writing } = await loadWriting(values.slug!);
    assert(!writing.draft, 'A recommendation cannot target an authored draft.');
    const publication = publishingIdentity().publicationUri;
    const document = `at://${process.env.NEXT_PUBLIC_ATPROTO_DID}/site.standard.document/${documentRkey(`/writings/${values.slug}`, writing.published)}`;
    const pds = await resolvePds(visitor as Did);
    const secondPds = await resolvePds(secondVisitor as Did);
    async function matches(
      did: string,
      service: string,
      collection: string,
      field: string,
      target?: string
    ) {
      const records: {
        uri: string;
        cid: string;
        value: Record<string, unknown>;
      }[] = [];
      let cursor: string | undefined;
      do {
        const url = new URL('/xrpc/com.atproto.repo.listRecords', service);
        url.search = new URLSearchParams({
          repo: did,
          collection,
          limit: '100',
          ...(cursor && { cursor }),
        }).toString();
        const response = await fetch(url, {
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
        assert(
          response.ok,
          `Public visitor PDS read failed (${response.status}).`
        );
        const page = (await response.json()) as {
          records: typeof records;
          cursor?: string;
        };
        records.push(
          ...page.records.filter(
            (record) => target === undefined || record.value[field] === target
          )
        );
        cursor = page.cursor;
      } while (cursor);
      return records;
    }
    const subscriptions = (did = visitor, service = pds) =>
      matches(
        did,
        service,
        'site.standard.graph.subscription',
        'publication',
        publication
      );
    const recommendations = (did = visitor, service = pds) =>
      matches(
        did,
        service,
        'site.standard.graph.recommend',
        'document',
        document
      );
    for (const owned of primaryExport.owned) {
      const collection =
        owned.kind === 'subscription'
          ? 'site.standard.graph.subscription'
          : 'site.standard.graph.recommend';
      assert(owned.uri.startsWith(`at://${visitor}/${collection}/`));
      assert.equal(
        owned.target,
        owned.kind === 'subscription' ? publication : document
      );
    }
    const initialRecords = [
      ...(await subscriptions()),
      ...(await recommendations()),
    ];
    assert(
      initialRecords.every((record) =>
        primaryExport.owned.some(
          (owned) => owned.uri === record.uri && owned.cid === record.cid
        )
      ),
      'Preexisting matching records are not owned by this capture. Refuse to remove them.'
    );
    async function undo(kind: 'subscription' | 'recommendation') {
      const current = await (kind === 'subscription'
        ? subscriptions()
        : recommendations());
      assert(
        current.every((record) =>
          receipt.owned.some(
            (owned) => owned.uri === record.uri && owned.kind === kind
          )
        ),
        'Undo would remove an unjournaled record.'
      );
      if (current.length) await mutate(kind, 'DELETE');
    }
    const initial = await status();
    assert(
      initial.enabled && initial.ready && initial.signedIn,
      'Sign in through the actual acceptance browser and verify the published target first.'
    );
    const secondInitial = await status(secondCookie);
    assert(
      secondInitial.enabled && secondInitial.ready && secondInitial.signedIn
    );
    const secondRecords = {
      subscriptions: await subscriptions(secondVisitor, secondPds),
      recommendations: await recommendations(secondVisitor, secondPds),
    };
    receipt = {
      started: new Date().toISOString(),
      publisher: process.env.NEXT_PUBLIC_ATPROTO_DID!,
      visitor,
      secondVisitor,
      target: document,
      checks: [],
      pending: [],
      owned: [...primaryExport.owned],
      cleanup: 'pending',
    };
    if (!values.write) {
      console.log(
        'Preflight passed against two existing real provider grants. No social writes occurred. --write exercises the controlled acceptance targets and removes matching primary-visitor test records afterward.'
      );
      process.exitCode = 0;
    } else {
      try {
        await readFile(values.receipt!, 'utf8');
        throw new Error(
          'The receipt already exists. Choose another --receipt path.'
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      await save();
      let failure: unknown;
      try {
        await checked(
          'Existing real OAuth grants and Secure/HttpOnly/Lax cookies are accepted',
          { visitor, secondVisitor }
        );
        const metadataResponse = await fetch(
          `${ORIGIN}/oauth-client-metadata.json`,
          {
            redirect: 'error',
            signal: AbortSignal.timeout(15000),
          }
        );
        assert.equal(metadataResponse.status, 200);
        const metadata = (await metadataResponse.json()) as { scope: string };
        assert.equal(
          metadata.scope,
          'atproto include:site.standard.authSocial'
        );
        assert(process.env.ATPROTO_OAUTH_STORAGE_KEY);
        const { decryptOAuthValue } =
          await import('../lib/atproto/oauth-crypto');
        const grants = [];
        for (const did of [visitor, secondVisitor]) {
          const stored =
            await database.sql`SELECT encrypted_value FROM atproto_oauth_sessions WHERE key_hash = ${digest(did)} AND expires_at > NOW()`;
          assert.equal(stored.rows.length, 1);
          const tokens: StoredSession['tokenSet'] =
            decryptOAuthValue<StoredSession>(
              stored.rows[0].encrypted_value as string,
              process.env.ATPROTO_OAUTH_STORAGE_KEY
            ).tokenSet;
          assert.equal(tokens.sub, did);
          assert.equal(tokens.token_type, 'DPoP');
          assert.equal(
            new URL(tokens.aud).href,
            new URL(await resolvePds(did as Did)).href
          );
          if (process.env.ATPROTO_ACCEPTANCE_PROVIDER_ORIGIN)
            assert.equal(
              tokens.iss,
              process.env.ATPROTO_ACCEPTANCE_PROVIDER_ORIGIN
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
          grants.push({
            subject: tokens.sub,
            issuer: tokens.iss,
            audience: tokens.aud,
            scope: tokens.scope,
            tokenType: tokens.token_type,
          });
        }
        await checked(
          'Deployed metadata and real DPoP grants request Standard.site social permissions',
          { grants }
        );
        console.log(
          'Step 2: Reject anonymous and cross-origin mutations without changing PDS records.'
        );
        const before = await subscriptions();
        assert.equal(
          (await request('/api/atproto/subscription', 'PUT', '', {})).status,
          401
        );
        assert.equal(
          (
            await request(
              '/api/atproto/subscription',
              'PUT',
              primaryCookie,
              {},
              'https://example.com'
            )
          ).status,
          403
        );
        assert.deepEqual(await subscriptions(), before);
        await checked('Anonymous and cross-origin requests cannot write');
        async function allGraphRecords() {
          const graph = [];
          for (const [did, service] of [
            [visitor, pds],
            [secondVisitor, secondPds],
          ]) {
            for (const [collection, field] of [
              ['site.standard.graph.subscription', 'publication'],
              ['site.standard.graph.recommend', 'document'],
            ])
              graph.push(...(await matches(did, service, collection, field)));
          }
          return graph
            .map(({ uri, cid }) => ({ uri, cid }))
            .sort((a, b) => a.uri.localeCompare(b.uri));
        }
        const graphBeforeRejectedTargets = await allGraphRecords();
        const missingSlug = `acceptance-missing-${Date.now()}`;
        await assert.rejects(() => loadWriting(missingSlug));
        let authoredDraft: typeof writing | undefined;
        for (const slug of await getWritingSlugs()) {
          const candidate = await loadWriting(slug);
          if (candidate.writing.draft) {
            authoredDraft = candidate.writing;
            break;
          }
        }
        assert(
          authoredDraft,
          'The negative target check requires an existing private authored draft.'
        );
        for (const slug of [missingSlug, authoredDraft.slug]) {
          for (const method of ['PUT', 'DELETE'] as const) {
            const rejected = await writeRequest(
              '/api/atproto/recommendation',
              method,
              { slug }
            );
            assert.equal(
              rejected.status,
              404,
              'Missing and draft recommendation targets must be rejected.'
            );
            assert.deepEqual(
              await allGraphRecords(),
              graphBeforeRejectedTargets
            );
          }
        }
        await checked(
          'Missing writings and authored drafts reject create and undo without changing either visitor graph'
        );

        // OAuth callbacks complete a pending action. Clear only this isolated
        // visitor's test targets before measuring idempotent creation.
        await undo('subscription');
        await undo('recommendation');
        console.log(
          'Step 3: Execute repeated and concurrent real writes, then inspect the visitor PDS.'
        );
        if (
          visitor === process.env.NEXT_PUBLIC_ATPROTO_DID &&
          process.env.ATPROTO_APP_PASSWORD
        ) {
          const { createRepoClient } = await import('../lib/atproto/client');
          externalClient = await createRepoClient(
            process.env.ATPROTO_APP_PASSWORD
          );
        } else
          receipt.pending.push(
            'Second-client graph recognition requires the isolated publisher as the first visitor and its existing app password.'
          );
        for (const [kind, records, field] of [
          ['subscription', subscriptions, 'subscribed'],
          ['recommendation', recommendations, 'recommended'],
        ] as const) {
          await Promise.all([mutate(kind, 'PUT'), mutate(kind, 'PUT')]);
          await mutate(kind, 'PUT');
          const created = await records();
          receipt.owned.push(
            ...created.map((record) => ({
              uri: record.uri,
              cid: record.cid,
              kind,
              target: kind === 'subscription' ? publication : document,
            }))
          );
          await save();
          assert.equal(
            created.length,
            1,
            'Repeated/concurrent writes must create one matching record.'
          );
          assert.equal((await status())[field], true);
          await checked(
            `Real ${kind} writes are idempotent and match public PDS state`,
            { uri: created[0].uri, cid: created[0].cid }
          );
          await undo(kind);
          assert.equal((await records()).length, 0);
          assert.equal((await status())[field], false);
          await checked(`Explicit ${kind} undo removes matching PDS records`);
          if (externalClient) {
            const collection =
              kind === 'subscription'
                ? 'site.standard.graph.subscription'
                : 'site.standard.graph.recommend';
            const target = kind === 'subscription' ? publication : document;
            for (let index = 0; index < 2; index++) {
              const key = now();
              const uri = `at://${visitor}/${collection}/${key}`;
              assert(!(await externalClient.getRecord!(collection, key)));
              const journal = { uri, cid: '', kind, target };
              receipt.owned.push(journal);
              await save();
              const created: { uri: string; cid: string } =
                await externalClient.createRecord!(collection, key, {
                  $type: collection,
                  [kind === 'subscription' ? 'publication' : 'document']:
                    target,
                  createdAt: new Date().toISOString(),
                });
              assert.equal(created.uri, uri);
              journal.cid = created.cid;
              await save();
            }
            assert.equal((await status())[field], true);
            await mutate(kind, 'PUT');
            assert.equal(
              (await records()).length,
              2,
              'Recognition must not create a third record.'
            );
            await undo(kind);
            assert.equal((await records()).length, 0);
            await checked(
              `Real ${kind} records created by a second publishing client are recognized and explicitly removed`
            );
          }
        }
        assert.deepEqual(await status(secondCookie), secondInitial);
        assert.deepEqual(
          {
            subscriptions: await subscriptions(secondVisitor, secondPds),
            recommendations: await recommendations(secondVisitor, secondPds),
          },
          secondRecords
        );
        await checked(
          'One visitor cannot change another account or browser state'
        );

        console.log('Step 4: Verify a captured real callback rejects replay.');
        if (values['callback-file']) {
          const callback = JSON.parse(
            await readFile(values['callback-file'], 'utf8')
          ) as CapturedCallback;
          assert(process.env.ATPROTO_OAUTH_STORAGE_KEY);
          verifyCallbackSignature(
            callback,
            process.env.ATPROTO_OAUTH_STORAGE_KEY
          );
          const url = new URL(callback.url);
          assert(url.origin === ORIGIN && url.pathname === '/atproto/callback');
          assert(url.searchParams.has('code') && url.searchParams.has('state'));
          assert(callback.expectation === 'grant' && callback.sessionReplaced);
          assert(
            new URL(callback.location).origin === ORIGIN &&
              !callback.location.includes('atprotoError=1')
          );
          assert.equal(callback.issuedStateHash, callback.stateHash);
          assert.equal(callback.outcome, 'authorized');
          assert.equal(callback.visitor, visitor);
          assert.equal(callback.sessionHash, digest(primaryCookie));
          assert.equal(
            callback.stateHash,
            digest(url.searchParams.get('state')!)
          );
          assert(callback.wrongBrowserRejected);
          assert.equal(primaryExport.grant?.outcome, 'authorized');
          assert.equal(primaryExport.grant?.did, visitor);
          assert.equal(primaryExport.grant?.sessionHash, callback.sessionHash);
          assert.equal(
            primaryExport.grant?.callbackStateHash,
            callback.stateHash
          );
          assert.equal(
            (
              await database.sql`SELECT key_hash FROM atproto_oauth_states WHERE key_hash = ${callback.stateHash}`
            ).rows.length,
            0,
            'Successful authorization must already have consumed this state.'
          );
          const beforeSessions =
            await database.sql`SELECT token_hash FROM atproto_browser_sessions WHERE did = ${visitor}`;
          const replay = await fetch(url, {
            redirect: 'manual',
            signal: AbortSignal.timeout(60000),
            headers: { cookie: `atproto_flow=${callback.flowCookie}` },
          });
          assert.equal(replay.status, 303);
          assert(replay.headers.get('location')?.includes('atprotoError=1'));
          assert(
            !replay.headers
              .getSetCookie()
              .some((cookie) => cookie.startsWith('atproto_session='))
          );
          const afterSessions =
            await database.sql`SELECT token_hash FROM atproto_browser_sessions WHERE did = ${visitor}`;
          assert.deepEqual(
            afterSessions.rows.sort((a, b) =>
              a.token_hash.localeCompare(b.token_hash)
            ),
            beforeSessions.rows.sort((a, b) =>
              a.token_hash.localeCompare(b.token_hash)
            )
          );
          await checked(
            'A captured consumed provider callback cannot create a new session or replay its action'
          );
        } else
          receipt.pending.push(
            'Capture the original successful provider callback and flow cookie privately, then verify replay with --callback-file.'
          );
        for (const [option, expected] of [
          ['cancelled-callback-file', 'cancel'],
          ['expired-callback-file', 'expired'],
        ] as const) {
          const filename = values[option];
          if (!filename) {
            receipt.pending.push(
              `Complete real provider ${expected} flow with the capture companion.`
            );
            continue;
          }
          const proof = JSON.parse(
            await readFile(filename, 'utf8')
          ) as CapturedCallback;
          assert(process.env.ATPROTO_OAUTH_STORAGE_KEY);
          verifyCallbackSignature(proof, process.env.ATPROTO_OAUTH_STORAGE_KEY);
          const url = new URL(proof.url);
          assert(url.origin === ORIGIN && url.pathname === '/atproto/callback');
          assert(
            proof.expectation === expected && proof.outcome === 'rejected'
          );
          assert(
            new URL(proof.location).origin === ORIGIN &&
              proof.location.includes('atprotoError=1') &&
              !proof.sessionReplaced
          );
          assert(proof.visitor === secondVisitor);
          assert(proof.sessionHash === digest(secondCookie));
          assert(proof.stateHash === digest(url.searchParams.get('state')!));
          assert(secondExport.grant?.outcome === 'authorized');
          assert(
            secondExport.grant.did === secondVisitor &&
              secondExport.grant.sessionHash === proof.sessionHash
          );
          assert(
            (
              await database.sql`SELECT key_hash FROM atproto_oauth_states WHERE key_hash = ${proof.stateHash}`
            ).rows.length === 0,
            'Rejected authorization must leave no reusable captured state.'
          );
          assert((await browserDid(secondCookie)) === secondVisitor);
          if (expected === 'cancel')
            assert.equal(url.searchParams.get('error'), 'access_denied');
          else
            assert(
              url.searchParams.has('code') && proof.expirySource,
              'Expiry proof requires a real provider code and its controlled expiration receipt.'
            );
          await checked(
            `Real provider ${expected} callback rejects the action without replacing a session`,
            { expirySource: proof.expirySource }
          );
        }

        const signedOutFile = values['signed-out-cancelled-callback-file'];
        if (signedOutFile) {
          const proof = JSON.parse(
            await readFile(signedOutFile, 'utf8')
          ) as CapturedCallback;
          assert(process.env.ATPROTO_OAUTH_STORAGE_KEY);
          verifyCallbackSignature(proof, process.env.ATPROTO_OAUTH_STORAGE_KEY);
          const callback = new URL(proof.url);
          assert(
            callback.origin === ORIGIN &&
              callback.pathname === '/atproto/callback'
          );
          assert(
            proof.expectation === 'cancel' &&
              proof.outcome === 'rejected' &&
              !proof.sessionReplaced
          );
          assert.equal(
            proof.sessionHash,
            digest(''),
            'This signed proof denotes the observed absent session cookie, never an authenticated session.'
          );
          assert(
            proof.visitor === secondVisitor &&
              callback.searchParams.get('error') === 'access_denied'
          );
          assert.equal(
            proof.stateHash,
            digest(callback.searchParams.get('state')!)
          );
          assert(proof.location === `${ORIGIN}/writings?atprotoError=1`);
          assert.equal(
            (
              await database.sql`SELECT token_hash FROM atproto_browser_sessions WHERE token_hash = ${proof.sessionHash}`
            ).rows.length,
            0
          );
          assert.equal(
            (
              await database.sql`SELECT key_hash FROM atproto_oauth_states WHERE key_hash = ${proof.stateHash}`
            ).rows.length,
            0
          );
          await checked(
            'A fresh signed-out browser declined genuine provider authorization and returned without a session or social write',
            {
              sessionCookie: 'absent',
              sessionHashMeaning:
                'SHA256 of the actually absent cookie; not an authenticated session hash',
            }
          );
        } else
          receipt.pending.push(
            'Fresh signed-out provider cancellation has no captured genuine callback proof.'
          );

        console.log(
          'Step 5: Force real provider refresh in two isolated processes without changing provider data.'
        );
        assert(
          process.env.ATPROTO_OAUTH_STORAGE_KEY &&
            process.env.ATPROTO_OAUTH_JWK,
          'Real forced refresh requires matching acceptance keys.'
        );
        const refreshFile = fileURLToPath(
          new URL('./atproto-refresh-acceptance.mts', import.meta.url)
        );
        async function refreshInstance() {
          return new Promise<Record<string, unknown>>((finish, reject) => {
            let stdout = '';
            const child = spawn(
              'pnpm',
              [
                'exec',
                'tsx',
                refreshFile,
                '--env',
                resolve(values.env!),
                '--visitor',
                visitor,
              ],
              {
                cwd: process.cwd(),
                env: process.env,
                stdio: ['ignore', 'pipe', 'pipe'],
              }
            );
            child.stdout.on('data', (chunk: Buffer) => {
              stdout += chunk.toString();
            });
            child.stderr.on('data', () => {});
            child.on('error', reject);
            const timeout = setTimeout(() => {
              child.kill('SIGTERM');
              reject(new Error('Real refresh instance exceeded 120 seconds.'));
            }, 120000);
            child.on('exit', (code) => {
              clearTimeout(timeout);
              if (code !== 0)
                return reject(
                  new Error(
                    'A real refresh instance failed without exposing credentials.'
                  )
                );
              try {
                const result = JSON.parse(stdout.trim()) as Record<
                  string,
                  unknown
                >;
                assert.equal(result.status, 'passed');
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
        const instances = await Promise.all([
          refreshInstance(),
          refreshInstance(),
        ]);
        assert.notEqual(instances[0].pid, instances[1].pid);
        await checked(
          'Two isolated processes force real provider refresh under distributed locks and read the authenticated PDS',
          { instances, forcedRefresh: true, naturalExpiry: false }
        );
        if (refreshSeconds) {
          assert(
            process.env.ATPROTO_OAUTH_STORAGE_KEY,
            'Real refresh proof requires the matching acceptance storage key.'
          );
          const { decryptOAuthValue } =
            await import('../lib/atproto/oauth-crypto');
          const sessionRow =
            await database.sql`SELECT encrypted_value FROM atproto_oauth_sessions WHERE key_hash = ${digest(visitor)}`;
          assert.equal(sessionRow.rows.length, 1);
          const initialTokens = decryptOAuthValue<StoredSession>(
            sessionRow.rows[0].encrypted_value as string,
            process.env.ATPROTO_OAUTH_STORAGE_KEY
          ).tokenSet;
          assert.equal(initialTokens.sub, visitor);
          assert(
            initialTokens.expires_at && initialTokens.refresh_token,
            'Provider must supply expiry and refresh credentials for this check.'
          );
          const initialAccessHash = digest(initialTokens.access_token);
          const deadline = Date.now() + refreshSeconds * 1000;
          let refreshed = false;
          while (Date.now() < deadline) {
            await new Promise((resolve) =>
              setTimeout(resolve, Math.min(55000, deadline - Date.now()))
            );
            const [first, second] = await Promise.all([status(), status()]);
            assert(first.signedIn && second.signedIn);
            const current =
              await database.sql`SELECT encrypted_value FROM atproto_oauth_sessions WHERE key_hash = ${digest(visitor)}`;
            if (current.rows.length === 1) {
              const tokens: StoredSession['tokenSet'] =
                decryptOAuthValue<StoredSession>(
                  current.rows[0].encrypted_value as string,
                  process.env.ATPROTO_OAUTH_STORAGE_KEY
                ).tokenSet;
              assert.equal(tokens.sub, visitor);
              assert.equal(tokens.iss, initialTokens.iss);
              assert.equal(tokens.aud, initialTokens.aud);
              if (
                tokens.expires_at &&
                tokens.expires_at > initialTokens.expires_at &&
                digest(tokens.access_token) !== initialAccessHash
              ) {
                refreshed = true;
                await checked(
                  'Provider token expiry advances and the actual access token generation changes',
                  {
                    beforeExpiresAt: new Date(
                      initialTokens.expires_at
                    ).toISOString(),
                    afterExpiresAt: new Date(tokens.expires_at).toISOString(),
                    refreshTokenRotated:
                      tokens.refresh_token !== initialTokens.refresh_token,
                  }
                );
                break;
              }
            }
          }
          assert(
            refreshed,
            'No real provider refresh was observed during the bounded wait. Extend --refresh-wait-seconds without replacing provider data.'
          );
          await checked(
            'Concurrent requests preserve a real naturally refreshed provider session'
          );
        }

        const originalBrowser =
          await database.sql`SELECT expires_at FROM atproto_browser_sessions WHERE token_hash = ${digest(primaryCookie)} AND did = ${visitor}`;
        assert.equal(originalBrowser.rows.length, 1);
        const expiryBrowser = await chromium.launch({ headless: true });
        try {
          const expiryContext = await expiryBrowser.newContext({
            viewport: { width: 1440, height: 1000 },
          });
          await expiryContext.addCookies([primaryExport.browserCookie]);
          const expiryPage = await expiryContext.newPage();
          await expiryPage.goto(`${ORIGIN}/writings/${values.slug}`);
          const recommendation = expiryPage.locator(
            '[data-standard-social="recommendation"]'
          );
          await recommendation
            .getByRole('button', { name: 'Recommend', exact: true })
            .waitFor();
          await captureSocialState(
            expiryPage,
            dirname(values.receipt!),
            'browser-session-before-expiry'
          );
          await database.sql`UPDATE atproto_browser_sessions SET expires_at = NOW() - INTERVAL '1 second' WHERE token_hash = ${digest(primaryCookie)} AND did = ${visitor}`;
          const expiredAction = expiryPage.waitForResponse(
            (response) =>
              response.url() === `${ORIGIN}/api/atproto/recommendation` &&
              response.request().method() === 'PUT'
          );
          await recommendation
            .getByRole('button', { name: 'Recommend', exact: true })
            .click();
          assert.equal((await expiredAction).status(), 401);
          await expiryPage.getByRole('dialog').waitFor({ state: 'visible' });
          await expiryPage.getByLabel('Your handle', { exact: true }).waitFor();
          assert.equal((await status()).signedIn, false);
          await captureSocialState(
            expiryPage,
            dirname(values.receipt!),
            'browser-session-expired-sign-in-recovery'
          );
          assert.equal(
            (
              await request(
                '/api/atproto/subscription',
                'PUT',
                primaryCookie,
                {}
              )
            ).status,
            401
          );
          assert.equal((await subscriptions()).length, 0);
          await checked(
            'A genuinely issued browser session rejects reads/writes after its isolated deadline is moved into the past'
          );
        } finally {
          try {
            await database.sql`UPDATE atproto_browser_sessions SET expires_at = ${new Date(originalBrowser.rows[0].expires_at as string).toISOString()} WHERE token_hash = ${digest(primaryCookie)} AND did = ${visitor}`;
          } finally {
            await expiryBrowser.close();
          }
        }

        console.log(
          'Step 6: Sign out the primary browser and verify the second visitor remains signed in.'
        );
        const logout = await request(
          '/api/atproto/logout',
          'POST',
          primaryCookie,
          {}
        );
        assert.equal(logout.status, 200);
        assert(
          logout.headers
            .getSetCookie()
            .some(
              (cookie) =>
                cookie.startsWith('atproto_session=') &&
                cookie.includes('Max-Age=0')
            )
        );
        assert.equal((await status()).signedIn, false);
        assert.equal((await status(secondCookie)).signedIn, true);
        assert.equal(
          (
            await database.sql`SELECT token_hash FROM atproto_browser_sessions WHERE token_hash = ${digest(primaryCookie)}`
          ).rows.length,
          0
        );
        await checked('Sign-out revokes only the current browser session');
      } catch (error) {
        failure = error;
        receipt.error = error instanceof Error ? error.message : String(error);
      }
      console.log(
        'Step 7: Verify the primary visitor has no acceptance social records and the other visitor is unchanged.'
      );
      try {
        if ((await status()).signedIn) {
          await undo('subscription');
          await undo('recommendation');
        }
        assert.equal((await subscriptions()).length, 0);
        assert.equal((await recommendations()).length, 0);
        assert.deepEqual(
          {
            subscriptions: await subscriptions(secondVisitor, secondPds),
            recommendations: await recommendations(secondVisitor, secondPds),
          },
          secondRecords
        );
        receipt.cleanup = 'passed';
      } catch (error) {
        receipt.cleanup = 'failed';
        receipt.error = `${receipt.error ?? ''} Cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
        failure = error;
      }
      await save();
      if (failure) throw failure;
      console.log(
        `Real social checks passed. Receipt: ${values.receipt}. ${receipt.pending.length} distinct provider-flow checks remain pending.`
      );
    }
  } finally {
    await externalClient?.close().catch(() => {});
    await database.end();
  }
}
await main().catch(() => {
  console.error(
    'Real social acceptance failed. Consult the private receipt and capture ownership ledger. Provider URLs, credentials, and cookie values are withheld.'
  );
  process.exitCode = 1;
});
