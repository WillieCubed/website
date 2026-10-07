'use client';

import { type FormEvent, useEffect, useId, useState } from 'react';

interface SocialState {
  enabled: boolean;
  signedIn: boolean;
  subscribed?: boolean;
  recommended?: boolean;
}
interface Props {
  action: 'subscription' | 'recommendation';
  slug?: string;
}

const buttonStyle =
  'inline-flex items-center justify-center rounded-full border border-line bg-card px-4 py-2 text-label-large font-medium text-ink transition-colors hover:border-accent hover:bg-tray disabled:opacity-50';

export default function StandardSocialControls({ action, slug }: Props) {
  const [state, setState] = useState<SocialState | null>(null);
  const [signIn, setSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const id = useId();
  const active =
    action === 'subscription' ? state?.subscribed : state?.recommended;
  const label = action === 'subscription' ? 'Subscribe' : 'Recommend';

  useEffect(() => {
    const controller = new AbortController();
    const query = slug ? '?slug=' + encodeURIComponent(slug) : '';
    fetch('/api/atproto/social' + query, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setState({ enabled: true, signedIn: false });
          return;
        }
        if (!response.ok) {
          setError(
            data.error ?? 'This action is unavailable. Try again later.'
          );
          return;
        }
        setState(data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError('This action is unavailable. Try again later.');
      });
    const url = new URL(window.location.href);
    if (url.searchParams.has('atprotoError')) {
      setError('Sign-in or the requested action did not finish. Try again.');
      url.searchParams.delete('atprotoError');
      window.history.replaceState(window.history.state, '', url.href);
    }
    return () => controller.abort();
  }, [slug, attempt]);

  async function beginSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/atproto/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? 'Sign-in did not start. Try again.');
      window.location.assign(result.url);
    } catch (problem) {
      setError(
        problem instanceof Error ? problem.message : 'Sign-in did not start.'
      );
      setBusy(false);
    }
  }

  async function toggle() {
    if (!state?.signedIn) {
      setSignIn(true);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/atproto/' + action, {
        method: active ? 'DELETE' : 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 401) {
          setState({ enabled: true, signedIn: false });
          setSignIn(true);
        }
        throw new Error(data.error ?? 'This action did not finish. Try again.');
      }
      setState((current) => ({
        ...current!,
        [action === 'subscription' ? 'subscribed' : 'recommended']: data.active,
      }));
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : 'This action did not finish. Try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    try {
      const response = await fetch('/api/atproto/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error('Sign-out failed. Try again.');
      setState({ enabled: true, signedIn: false });
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Sign-out failed.');
    } finally {
      setBusy(false);
    }
  }

  if (state?.enabled === false) return null;
  return (
    <div className="max-w-full" data-standard-social={action}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={buttonStyle}
          disabled={busy || !state}
          aria-pressed={Boolean(active)}
          aria-expanded={signIn}
          aria-controls={id}
          onClick={toggle}
        >
          {active
            ? action === 'subscription'
              ? 'Subscribed'
              : 'Recommended'
            : label}
        </button>
        {state?.signedIn && (
          <button
            type="button"
            disabled={busy}
            className="text-label-medium text-muted underline underline-offset-4"
            onClick={signOut}
          >
            Sign out
          </button>
        )}
      </div>
      {active && (
        <p className="mt-1 text-label-small text-muted">
          Click again to{' '}
          {action === 'subscription'
            ? 'unsubscribe'
            : 'remove your recommendation'}
          .
        </p>
      )}
      <div id={id} hidden={!signIn}>
        <form
          method="post"
          action="/api/atproto/login"
          onSubmit={beginSignIn}
          className="mt-3 flex max-w-sm flex-wrap items-end gap-2 rounded-2xl border border-line bg-card p-4"
        >
          <input type="hidden" name="action" value={action} />
          {slug && <input type="hidden" name="slug" value={slug} />}
          <label htmlFor={id + '-handle'} className="w-full text-body-medium">
            Sign in to {label.toLowerCase()} with your account.
          </label>
          <label
            className="min-w-0 flex-1 text-label-medium"
            htmlFor={id + '-handle'}
          >
            Your handle
            <input
              id={id + '-handle'}
              name="handle"
              type="text"
              required
              maxLength={253}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="username"
              placeholder="you.bsky.social"
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-body-medium text-ink"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-primary px-4 py-2 text-label-large font-medium text-on-primary"
          >
            Continue
          </button>
          <button
            type="button"
            className="text-label-medium text-muted"
            onClick={() => setSignIn(false)}
          >
            Cancel
          </button>
        </form>
      </div>
      {error && (
        <p role="alert" className="mt-2 max-w-sm text-label-medium text-muted">
          {error}
          {!state && (
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => {
                setError('');
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </button>
          )}
        </p>
      )}
    </div>
  );
}
