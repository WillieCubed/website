import type { ActorIdentifier } from '@atcute/lexicons';

import { site } from '@/lib/site/identity';

import { socialSettings } from './config';
import { validateBrowserBinding } from './oauth-binding';
import { buildOAuthClient, oauthClient } from './oauth-client';
import {
  deleteBrowserSession,
  issueBrowserSession,
  oauthStores,
  readBrowserSession,
  socialRateLimit,
  withOAuthLock,
} from './oauth-storage';
import {
  type LoginIntent,
  SocialCallbackError,
  type SocialHandlers,
  SocialHttpError,
  type SocialServices,
  createSocialHandlers,
  requestCookie,
} from './social-http';
import { graphRepo } from './social-repo';
import { verifiedSocialTarget } from './social-targets';

export { oauthClient } from './oauth-client';

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
    repo: (did) => graphRepo(did, oauthClient()),
    lock: withOAuthLock,
  };
}

export function socialHandlers(): SocialHandlers {
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
