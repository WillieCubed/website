import type { ActorResolver } from '@atcute/identity-resolver';
import {
  type AtprotoAuthorizationServerMetadata,
  type AtprotoProtectedResourceMetadata,
  type ConfidentialClientMetadata,
  MemoryStore,
  OAuthClient,
  type StoredSession,
  type StoredState,
} from '@atcute/oauth-node-client';
import { sql } from '@vercel/postgres';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';

import { oauthClient } from '@/lib/atproto/oauth';
import { socialServices } from '@/lib/atproto/oauth';
import { digest } from '@/lib/atproto/oauth-binding';
import { createOAuthFetch } from '@/lib/atproto/oauth-fetch';
import {
  deleteBrowserSession,
  issueBrowserSession,
  oauthStores,
  readBrowserSession,
  withOAuthLock,
} from '@/lib/atproto/oauth-storage';
import { setGraphState } from '@/lib/atproto/social';

assert.equal(
  process.env.NEXT_PUBLIC_SITE_ORIGIN,
  'https://indieweb-acceptance.vercel.app',
  'These fixture writes require the isolated acceptance origin.'
);
const key = process.env.ATPROTO_OAUTH_STORAGE_KEY!;
const prefix = `acceptance-${randomBytes(12).toString('hex')}`;
const did = 'did:plc:aaaaaaaaaaaaaaaaaaaaaaaa';
const stores = oauthStores(key);
const flow = randomBytes(32).toString('hex');
const state = (expiresAt = Date.now() + 600000): StoredState => ({
  expiresAt,
  issuer: 'https://provider.acceptance.example',
  redirectUri: 'https://standard-acceptance.example/atproto/callback',
  pkceVerifier: 'fixture',
  authMethod: { method: 'none' } as unknown as StoredState['authMethod'],
  dpopKey: {} as StoredState['dpopKey'],
  sub: did,
  userState: {
    action: 'recommendation',
    slug: 'indieweb-acceptance',
    returnTo: '/writings/indieweb-acceptance',
    browserHash: digest(flow),
  },
});

test('durable state encrypts, expires, rejects wrong browsers, cancellation and replay', async () => {
  const id = prefix + 'state';
  try {
    await stores.states.set(id, state(Date.now() - 1000));
    assert.equal(await stores.states.get(id), undefined);
    await stores.states.set(id, state());
    const rows = await sql.query(
      'SELECT encrypted_value FROM atproto_oauth_states WHERE key_hash=$1',
      [digest(id)]
    );
    assert.ok(!rows.rows[0].encrypted_value.includes('pkceVerifier'));
    const params = new URLSearchParams({ state: id, error: 'access_denied' });
    await assert.rejects(socialServices().callback(params, 'other-browser'));
    assert.ok(await stores.states.get(id));
    await assert.rejects(
      socialServices().callback(params, flow),
      /Authorization did not finish/
    );
    assert.equal(await stores.states.get(id), undefined);
    await assert.rejects(socialServices().callback(params, flow));
  } finally {
    await stores.states.delete(id);
  }
});

test('browser sessions isolate visitors, expire and disappear on sign-out', async () => {
  const a = await issueBrowserSession(did);
  const b = await issueBrowserSession('did:plc:bbbbbbbbbbbbbbbbbbbbbbbb');
  try {
    assert.equal((await readBrowserSession(a))?.did, did);
    assert.equal(
      (await readBrowserSession(b))?.did,
      'did:plc:bbbbbbbbbbbbbbbbbbbbbbbb'
    );
    assert.equal(await readBrowserSession('fake'), null);
    await deleteBrowserSession(a);
    assert.equal(await readBrowserSession(a), null);
    assert.ok(await readBrowserSession(b));
    await sql.query(
      "UPDATE atproto_browser_sessions SET expires_at=NOW()-INTERVAL '1 second' WHERE token_hash=$1",
      [digest(b)]
    );
    assert.equal(await readBrowserSession(b), null);
  } finally {
    await deleteBrowserSession(a);
    await deleteBrowserSession(b);
  }
});

test('distributed and nested locks serialize writes without starving twelve distinct visitors', async () => {
  let active = 0,
    max = 0;
  let records: { uri: string; value: Record<string, unknown> }[] = [];
  let writes = 0;
  const repo = {
    list: async () => records,
    create: async (_collection: unknown, value: Record<string, unknown>) => {
      writes++;
      await new Promise((r) => setTimeout(r, 30));
      records = [
        { uri: 'at://' + did + '/site.standard.graph.subscription/key', value },
      ];
    },
    remove: async () => {},
  };
  await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      withOAuthLock(prefix + 'visitor' + i, async () => {
        await withOAuthLock(prefix + 'nested' + i, async () => {
          await stores.states.set(prefix + 'v' + i, state());
          assert.ok(await stores.states.get(prefix + 'v' + i));
          await stores.states.delete(prefix + 'v' + i);
        });
      })
    )
  );
  await Promise.all(
    Array.from({ length: 6 }, () =>
      withOAuthLock(prefix + 'shared', async () => {
        active++;
        max = Math.max(max, active);
        await setGraphState(
          repo,
          'subscription',
          'at://' + did + '/site.standard.publication/3khuwc44c222b',
          true
        );
        active--;
      })
    )
  );
  assert.equal(max, 1);
  assert.equal(writes, 1);
});

test('two server instances refresh one expired credential exactly once', async () => {
  const issuer = 'https://bsky.social';
  const pds = 'https://porcini.us-east.host.bsky.network';
  const signingKey = JSON.parse(process.env.ATPROTO_OAUTH_JWK!);
  let refreshes = 0;
  const fetcher = createOAuthFetch(async (url, init) => {
    if (url.pathname === '/.well-known/oauth-authorization-server')
      return Response.json({
        issuer,
        authorization_endpoint: issuer + '/authorize',
        token_endpoint: issuer + '/token',
        pushed_authorization_request_endpoint: issuer + '/par',
        client_id_metadata_document_supported: true,
        dpop_signing_alg_values_supported: ['ES256'],
        token_endpoint_auth_methods_supported: ['private_key_jwt'],
        token_endpoint_auth_signing_alg_values_supported: ['ES256'],
        protected_resources: [pds],
      });
    if (url.pathname === '/.well-known/oauth-protected-resource')
      return Response.json({
        resource: pds,
        authorization_servers: [issuer],
        bearer_methods_supported: ['header'],
      });
    assert.equal(url.href, issuer + '/token');
    assert.equal(init.method, 'POST');
    assert.ok(new Headers(init.headers).get('dpop'));
    const body = new URLSearchParams(await new Response(init.body).text());
    assert.equal(body.get('grant_type'), 'refresh_token');
    assert.equal(body.get('refresh_token'), 'single-use-refresh');
    assert.ok(body.get('client_assertion'));
    refreshes++;
    await new Promise((r) => setTimeout(r, 30));
    return Response.json({
      sub: did,
      access_token: 'fresh-access',
      refresh_token: 'fresh-refresh',
      token_type: 'DPoP',
      expires_in: 3600,
      scope: 'atproto include:site.standard.authSocial',
    });
  });
  const actorResolver = {
    resolve: async () => ({ did, pds, handle: 'reader.bsky.social' }),
  } as ActorResolver;
  const asMetadata = new MemoryStore<
    string,
    AtprotoAuthorizationServerMetadata
  >();
  const prMetadata = new MemoryStore<
    string,
    AtprotoProtectedResourceMetadata
  >();
  const make = () =>
    new OAuthClient({
      metadata: oauthClient().metadata as ConfidentialClientMetadata,
      keyset: [signingKey],
      actorResolver,
      stores: { ...oauthStores(key), asMetadata, prMetadata },
      requestLock: withOAuthLock,
      fetch: fetcher,
    });
  const session: StoredSession = {
    dpopKey: signingKey,
    authMethod: { method: 'private_key_jwt', kid: signingKey.kid },
    tokenSet: {
      iss: issuer,
      aud: pds,
      sub: did,
      scope: 'atproto include:site.standard.authSocial',
      token_type: 'DPoP',
      access_token: 'expired',
      refresh_token: 'single-use-refresh',
      expires_at: Date.now() - 1000,
    },
  };
  try {
    await stores.sessions.set(did, session);
    const a = make(),
      b = make();
    await Promise.all([a.restore(did), b.restore(did)]);
    assert.equal(refreshes, 1);
    assert.equal(
      (await stores.sessions.get(did))?.tokenSet.access_token,
      'fresh-access'
    );
  } finally {
    await stores.sessions.delete(did);
    asMetadata.dispose();
    prMetadata.dispose();
  }
});

test('a failed social operation does not roll back credential progress', async () => {
  const id = prefix + 'progress';
  try {
    await assert.rejects(
      withOAuthLock(prefix + 'failure', async () => {
        await stores.states.set(id, state());
        throw new Error('The PDS rejected the later write.');
      })
    );
    assert.ok(await stores.states.get(id));
  } finally {
    await stores.states.delete(id);
  }
});

test.after(async () => {
  await sql.end();
});
