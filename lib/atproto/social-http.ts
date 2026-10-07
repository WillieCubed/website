import { randomBytes } from 'node:crypto';

import { readCappedText } from '@/lib/indieweb/public-fetch';

import { digest } from './oauth-binding';
import {
  type GraphRepo,
  type SocialAction,
  graphState,
  setGraphState,
} from './social';

export interface LoginIntent {
  action: SocialAction;
  slug?: string;
  returnTo: string;
  browserHash?: string;
}
export interface BrowserSession {
  did: string;
  id: string;
}
export interface SocialServices {
  enabled: boolean;
  origin: string;
  session(request: Request): Promise<BrowserSession | null>;
  issueSession(did: string): Promise<string>;
  logout(request: Request): Promise<void>;
  rate(key: string): Promise<boolean>;
  authorize(handle: string, intent: LoginIntent): Promise<URL>;
  callback(
    params: URLSearchParams,
    flow: string
  ): Promise<{ did: string; intent: LoginIntent }>;
  target(action: SocialAction, slug?: string): Promise<string>;
  repo(did: string): Promise<GraphRepo>;
  lock<T>(name: string, fn: () => Promise<T>): Promise<T>;
}

export class SocialHttpError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export class SocialCallbackError extends Error {
  constructor(public intent: LoginIntent) {
    super('Authorization did not finish.');
  }
}

export function requestCookie(request: Request, name: string): string {
  return (
    request.headers
      .get('cookie')
      ?.split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith(name + '='))
      ?.slice(name.length + 1) ?? ''
  );
}

function cookie(
  name: string,
  value: string,
  seconds: number,
  origin: string
): string {
  const secure = origin.startsWith('https:') ? '; Secure' : '';
  return `${name}=${value}; Path=/; Max-Age=${seconds}; HttpOnly${secure}; SameSite=Lax`;
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' },
  });
}

async function body(request: Request): Promise<Record<string, unknown>> {
  const text = await readCappedText(request.body, 2048);
  if (text === null)
    throw new SocialHttpError('The request is too large.', 413);
  try {
    const parsed = request.headers
      .get('content-type')
      ?.includes('application/x-www-form-urlencoded')
      ? Object.fromEntries(new URLSearchParams(text))
      : JSON.parse(text || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error();
    return parsed;
  } catch {
    throw new SocialHttpError('The request is invalid.', 400);
  }
}

function checkedSlug(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,199}$/.test(value))
    throw new SocialHttpError('Choose a published writing.', 400);
  return value;
}

export function createSocialHandlers(services: SocialServices) {
  function mutation(request: Request) {
    if (!services.enabled)
      throw new SocialHttpError('Sign-in is unavailable.', 503);
    if (request.headers.get('origin') !== services.origin)
      throw new SocialHttpError('The request came from another site.', 403);
  }

  async function guarded(fn: () => Promise<Response>): Promise<Response> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof SocialHttpError)
        return json({ error: error.message }, error.status);
      console.error('Standard.site request failed.');
      return json(
        {
          error:
            'The account provider could not complete this action. Try again.',
        },
        502
      );
    }
  }

  async function perform(
    did: string,
    action: SocialAction,
    slug: string | undefined,
    active: boolean
  ) {
    const target = await services.target(action, slug);
    return services.lock(`social:${did}:${action}:${target}`, async () =>
      setGraphState(await services.repo(did), action, target, active)
    );
  }

  async function action(request: Request, kind: SocialAction) {
    return guarded(async () => {
      mutation(request);
      const session = await services.session(request);
      if (!session) throw new SocialHttpError('Sign in to continue.', 401);
      if (!(await services.rate(`write:${session.did}`)))
        throw new SocialHttpError('Wait a minute before trying again.', 429);
      const input = await body(request);
      const slug =
        kind === 'recommendation' ? checkedSlug(input.slug) : undefined;
      const active = await perform(
        session.did,
        kind,
        slug,
        request.method === 'PUT'
      );
      return json({ active });
    });
  }

  return {
    subscription: (request: Request) => action(request, 'subscription'),
    recommendation: (request: Request) => action(request, 'recommendation'),
    login: (request: Request) =>
      guarded(async () => {
        mutation(request);
        const ip =
          request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
          'unknown';
        if (!(await services.rate(`login:${ip}`)))
          throw new SocialHttpError(
            'Wait a minute before signing in again.',
            429
          );
        const input = await body(request);
        if (
          input.action !== 'subscription' &&
          input.action !== 'recommendation'
        )
          throw new SocialHttpError('Choose Subscribe or Recommend.', 400);
        if (
          typeof input.handle !== 'string' ||
          input.handle.length > 253 ||
          !/^(?:did:(?:plc|web):[^\s]+|[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,})$/.test(
            input.handle.trim()
          )
        )
          throw new SocialHttpError('Enter your account handle.', 400);
        const slug =
          input.action === 'recommendation'
            ? checkedSlug(input.slug)
            : undefined;
        const returnTo = slug ? `/writings/${slug}` : '/writings';
        await services.target(input.action, slug);
        const flow = randomBytes(32).toString('hex');
        const url = await services.authorize(input.handle.trim(), {
          action: input.action,
          slug,
          returnTo,
          browserHash: digest(flow),
        });
        const response = request.headers
          .get('content-type')
          ?.includes('application/json')
          ? json({ url: url.href })
          : new Response(null, {
              status: 303,
              headers: { location: url.href },
            });
        for (const [key, value] of Object.entries({
          'cache-control': 'no-store',
          'referrer-policy': 'no-referrer',
          'set-cookie': cookie('atproto_flow', flow, 600, services.origin),
        }))
          response.headers.set(key, value);
        return response;
      }),
    callback: async (request: Request) => {
      let destination = '/writings';
      let sessionId: string | undefined;
      try {
        if (!services.enabled) throw new Error('disabled');
        const { did, intent } = await services.callback(
          new URL(request.url).searchParams,
          requestCookie(request, 'atproto_flow')
        );
        destination =
          intent.action === 'recommendation'
            ? `/writings/${checkedSlug(intent.slug)}`
            : '/writings';
        sessionId = await services.issueSession(did);
        await perform(did, intent.action, intent.slug, true);
      } catch (error) {
        if (
          error instanceof SocialCallbackError &&
          error.intent.action === 'recommendation'
        )
          destination = `/writings/${checkedSlug(error.intent.slug)}`;
        destination += '?atprotoError=1';
      }
      const headers = new Headers({
        location: services.origin + destination,
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer',
      });
      headers.append(
        'set-cookie',
        cookie('atproto_flow', '', 0, services.origin)
      );
      if (sessionId)
        headers.append(
          'set-cookie',
          cookie('atproto_session', sessionId, 30 * 86400, services.origin)
        );
      return new Response(null, { status: 303, headers });
    },
    status: (request: Request) =>
      guarded(async () => {
        if (!services.enabled) return json({ enabled: false, signedIn: false });
        if (
          !(await services.rate(
            `read:${request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'}`
          ))
        )
          throw new SocialHttpError('Wait a minute before trying again.', 429);
        const slugParam = new URL(request.url).searchParams.get('slug');
        const slug = slugParam === null ? undefined : checkedSlug(slugParam);
        const session = await services.session(request);
        let publication: string;
        let document: string | undefined;
        try {
          publication = await services.target('subscription');
          document = slug
            ? await services.target('recommendation', slug)
            : undefined;
        } catch (error) {
          if (
            error instanceof SocialHttpError &&
            (error.status === 404 || error.status === 409)
          )
            return json({
              enabled: true,
              ready: false,
              signedIn: Boolean(session),
            });
          throw error;
        }
        if (!session)
          return json({
            enabled: true,
            ready: true,
            signedIn: false,
            subscribed: false,
            recommended: false,
          });
        const repo = await services.repo(session.did);
        const subscribed = await graphState(repo, 'subscription', publication);
        const recommended = document
          ? await graphState(repo, 'recommendation', document)
          : false;
        return json({
          enabled: true,
          ready: true,
          signedIn: true,
          subscribed,
          recommended,
        });
      }),
    logout: (request: Request) =>
      guarded(async () => {
        mutation(request);
        await services.logout(request);
        const response = json({ signedIn: false });
        response.headers.set(
          'set-cookie',
          cookie('atproto_session', '', 0, services.origin)
        );
        return response;
      }),
  };
}
