import type {} from '@atcute/atproto';
import {
  CompositeDidDocumentResolver,
  CompositeHandleResolver,
  LocalActorResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
  WellKnownHandleResolver,
} from '@atcute/identity-resolver';
import { NodeDnsHandleResolver } from '@atcute/identity-resolver-node';
import {
  type ClientAssertionPrivateJwk,
  OAuthClient,
  type StateStore,
} from '@atcute/oauth-node-client';

import { site } from '@/lib/site/identity';

import { socialSettings } from './config';
import { oauthFetch } from './oauth-fetch';
import { oauthStores, withOAuthLock } from './oauth-storage';
import { SocialHttpError } from './social-http';

let sharedClient: OAuthClient | undefined;
export function buildOAuthClient(states?: StateStore): OAuthClient {
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
