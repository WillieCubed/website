import type {} from '@atcute/atproto';
import { Client, ok } from '@atcute/client';
import {
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  LocalActorResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  WellKnownHandleResolver,
} from '@atcute/identity-resolver';
import { NodeDnsHandleResolver } from '@atcute/identity-resolver-node';
import type { ActorIdentifier, Did } from '@atcute/lexicons';
import {
  type ClientAssertionPrivateJwk,
  OAuthClient,
  type StateStore,
} from '@atcute/oauth-node-client';

import { site } from '@/lib/site';

import { socialSettings } from './config';
import { validateBrowserBinding } from './oauth-binding';
import { oauthFetch } from './oauth-fetch';
import {
  deleteBrowserSession,
  issueBrowserSession,
  oauthStores,
  readBrowserSession,
  socialRateLimit,
  withOAuthLock,
} from './oauth-storage';
import type { GraphRepo } from './social';
import {
  type LoginIntent,
  SocialCallbackError,
  SocialHttpError,
  type SocialServices,
  createSocialHandlers,
  requestCookie,
} from './social-http';
import { verifiedSocialTarget } from './social-targets';

let sharedClient: OAuthClient | undefined;
function buildOAuthClient(states?: StateStore): OAuthClient {
  const settings = socialSettings();
  if (!settings) throw new SocialHttpError('Sign-in is unavailable.', 503);
  const stores = oauthStores(settings.storageKey);
  return new OAuthClient({
    metadata: {
      client_id: `${site.origin}/oauth-client-metadata.json`,
      client_name: site.name,
      client_uri: site.origin,
      redirect_uris: [`${site.origin}/atproto/callback`],
      jwks_uri: `${site.origin}/.well-known/atproto-jwks.json`,
      scope: 'atproto include:site.standard.authSocial',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      application_type: 'web',
      token_endpoint_auth_method: 'private_key_jwt',
      token_endpoint_auth_signing_alg: 'ES256',
      dpop_bound_access_tokens: true,
    },
    keyset: [JSON.parse(settings.signingKey) as ClientAssertionPrivateJwk],
    stores: { ...stores, states: states ?? stores.states },
    requestLock: withOAuthLock,
    fetch: oauthFetch,
    actorResolver: new LocalActorResolver({
      handleResolver: new CompositeHandleResolver({
        methods: {
          dns: new NodeDnsHandleResolver(),
          http: new WellKnownHandleResolver({ fetch: oauthFetch }),
        },
      }),
      didDocumentResolver: new CompositeDidDocumentResolver({
        methods: {
          plc: new PlcDidDocumentResolver({ fetch: oauthFetch }),
          web: new WebDidDocumentResolver({ fetch: oauthFetch }),
        },
      }),
    }),
  });
}

export function oauthClient(): OAuthClient {
  return (sharedClient ??= buildOAuthClient());
}

async function graphRepo(did: string): Promise<GraphRepo> {
  const session = await oauthClient()
    .restore(did as Did)
    .catch(() => {
      throw new SocialHttpError(
        'Your sign-in has expired. Sign out and sign in again.',
        401
      );
    });
  const rpc = new Client({ handler: session });
  return {
    async list(collection) {
      const records = [];
      let cursor: string | undefined;
      do {
        const data = await ok(
          rpc.get('com.atproto.repo.listRecords', {
            params: { repo: did as Did, collection, limit: 100, cursor },
          })
        );
        records.push(
          ...data.records.map((record) => ({
            uri: record.uri,
            value: record.value as Record<string, unknown>,
          }))
        );
        cursor = data.cursor;
      } while (cursor);
      return records;
    },
    async create(collection, value) {
      await ok(
        rpc.post('com.atproto.repo.createRecord', {
          input: {
            repo: did as Did,
            collection,
            record: value,
            validate: false,
          },
        })
      );
    },
    async remove(collection, rkey) {
      await ok(
        rpc.post('com.atproto.repo.deleteRecord', {
          input: { repo: did as Did, collection, rkey },
        })
      );
    },
  };
}

export function socialServices(): SocialServices {
  const settings = socialSettings();
  return {
    enabled: Boolean(settings),
    origin: site.origin,
    session: (request) =>
      readBrowserSession(requestCookie(request, 'atproto_session')),
    issueSession: issueBrowserSession,
    logout: (request) =>
      deleteBrowserSession(requestCookie(request, 'atproto_session')),
    rate: socialRateLimit,
    authorize: async (handle, intent) =>
      (
        await oauthClient().authorize({
          target: { type: 'account', identifier: handle as ActorIdentifier },
          state: intent,
        })
      ).url,
    callback: async (params, flow) => {
      const stateId = params.get('state');
      if (!stateId || stateId.length > 200 || !flow)
        throw new SocialHttpError('This sign-in has expired.', 400);
      const stored = await withOAuthLock(`callback:${stateId}`, async () => {
        const states = oauthStores(settings!.storageKey).states;
        const stored = await states.get(stateId);
        validateBrowserBinding(stored?.userState, flow);
        await states.delete(stateId);
        return stored!;
      });
      // Consume before exchanging tokens so provider cancellation and failures
      // cannot roll back state deletion and make the callback reusable.
      let consumed = false;
      const client = buildOAuthClient({
        get: async (id) => (id === stateId && !consumed ? stored : undefined),
        delete: async () => {
          consumed = true;
        },
        set: async () => {
          throw new Error('Callback state is read-only.');
        },
        clear: async () => {
          consumed = true;
        },
      });
      try {
        const { session, state } = await withOAuthLock(
          `oauth-session-${stored.sub ?? stateId}`,
          () => client.callback(params)
        );
        return { did: session.did, intent: state as LoginIntent };
      } catch {
        throw new SocialCallbackError(stored.userState as LoginIntent);
      }
    },
    target: verifiedSocialTarget,
    repo: graphRepo,
    lock: withOAuthLock,
  };
}

export function socialHandlers() {
  return createSocialHandlers(socialServices());
}

export function oauthMetadata(kind: 'metadata' | 'jwks'): Response {
  if (!socialSettings())
    return Response.json({ error: 'Sign-in is unavailable.' }, { status: 503 });
  const client = oauthClient();
  return Response.json(kind === 'metadata' ? client.metadata : client.jwks, {
    headers: {
      'cache-control': 'public, max-age=300',
      'access-control-allow-origin': '*',
    },
  });
}
