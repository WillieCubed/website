'use client';

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';

import Icon from '@/components/icons/Icon';
import Popover from '@/components/site/Popover';
import { useBackdropDismiss } from '@/components/site/useBackdropDismiss';

import styles from './StandardSocialControls.module.css';

interface SocialState {
  enabled: boolean;
  ready: boolean;
  signedIn: boolean;
  subscribed?: boolean;
  recommended?: boolean;
}
interface Feedback {
  message: string;
  retry: 'action' | 'logout' | 'signin' | null;
  wait?: boolean;
}
interface Props {
  action: 'subscription' | 'recommendation';
  slug?: string;
}

export default function StandardSocialControls({ action, slug }: Props) {
  const [state, setState] = useState<SocialState | null>(null);
  const [signIn, setSignIn] = useState(false);
  const [pending, setPending] = useState<'action' | 'login' | 'logout' | null>(
    null
  );
  const [loginError, setLoginError] = useState('');
  const [loginInvalid, setLoginInvalid] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const busy = pending !== null;
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const actionButton = useRef<HTMLButtonElement>(null);
  const logoutButton = useRef<HTMLButtonElement>(null);
  const loginRequest = useRef<AbortController | null>(null);
  const restoreActionFocus = useRef(false);
  const backdrop = useBackdropDismiss(dismissSignIn);
  const active =
    action === 'subscription' ? state?.subscribed : state?.recommended;
  const label = action === 'subscription' ? 'Subscribe' : 'Recommend';
  const split = state?.signedIn && action === 'subscription';

  function dismissSignIn() {
    loginRequest.current?.abort();
    loginRequest.current = null;
    setPending(null);
    setSignIn(false);
  }

  useEffect(() => {
    if (!busy && restoreActionFocus.current) {
      restoreActionFocus.current = false;
      if (
        feedback?.retry === 'logout' &&
        logoutButton.current?.closest('[popover]')?.matches(':popover-open')
      )
        logoutButton.current.focus();
      else actionButton.current?.focus();
    }
  }, [busy, state?.signedIn, feedback]);

  useEffect(() => {
    if (!feedback?.wait) return;
    const timer = setTimeout(() => setFeedback(null), 60_000);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (!signIn) {
      modal.close();
      return;
    }
    modal.showModal();
    modal.querySelector<HTMLInputElement>('input[name="handle"]')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      loginRequest.current?.abort();
      loginRequest.current = null;
      modal.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [signIn]);

  useEffect(() => {
    const controller = new AbortController();
    const url = new URL(window.location.href);
    const returning = url.searchParams.has('atprotoError');
    if (returning) {
      url.searchParams.delete('atprotoError');
      window.history.replaceState(window.history.state, '', url.href);
    }
    const incomplete = () => {
      if (returning && !controller.signal.aborted)
        setFeedback({ message: 'That action did not finish.', retry: null });
    };
    const query = slug ? '?slug=' + encodeURIComponent(slug) : '';
    fetch('/api/atproto/social' + query, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const responseData = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok && response.status !== 401) {
          incomplete();
          return;
        }
        const data =
          response.status === 401
            ? { enabled: true, ready: true, signedIn: false }
            : responseData;
        setState(data);
        if (returning) {
          const confirmed =
            action === 'subscription' ? data.subscribed : data.recommended;
          if (!data.enabled || !data.ready)
            setFeedback({
              message:
                action === 'subscription'
                  ? 'Subscriptions are unavailable right now.'
                  : 'Recommendations are unavailable right now.',
              retry: null,
            });
          else if (!data.signedIn)
            setFeedback({
              message: 'Sign-in did not finish.',
              retry: 'signin',
            });
          else if (!confirmed)
            setFeedback({
              message:
                action === 'subscription'
                  ? 'Couldn’t subscribe.'
                  : 'Couldn’t recommend this writing.',
              retry: 'action',
            });
        }
      })
      .catch(incomplete);
    return () => controller.abort();
  }, [action, slug]);

  async function beginSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    const controller = new AbortController();
    loginRequest.current?.abort();
    loginRequest.current = controller;
    setPending('login');
    setLoginError('');
    setLoginInvalid(false);
    try {
      const response = await fetch('/api/atproto/login', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setLoginInvalid(response.status === 400 || response.status === 404);
        setLoginError(
          response.status === 400 || response.status === 404
            ? 'Check your handle and try again.'
            : response.status === 429
              ? 'Please wait a minute before trying again.'
              : 'Sign-in is unavailable right now. Please try again later.'
        );
        setPending(null);
        return;
      }
      window.location.assign(result.url);
    } catch {
      if (controller.signal.aborted) return;
      setLoginError('We couldn’t connect. Please try again.');
      setLoginInvalid(false);
      setPending(null);
    } finally {
      if (loginRequest.current === controller) loginRequest.current = null;
    }
  }

  async function toggle() {
    if (!state?.signedIn) {
      setFeedback(null);
      setLoginError('');
      setLoginInvalid(false);
      setSignIn(true);
      return;
    }
    restoreActionFocus.current = true;
    setPending('action');
    setFeedback(null);
    try {
      const response = await fetch('/api/atproto/' + action, {
        method: active ? 'DELETE' : 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          setState({ enabled: true, ready: true, signedIn: false });
          setLoginError('');
          setLoginInvalid(false);
          setSignIn(true);
          return;
        }
        if (response.status === 409 || response.status === 404) {
          setFeedback({
            message:
              action === 'subscription'
                ? 'Subscriptions are unavailable right now.'
                : 'Recommendations are unavailable right now.',
            retry: null,
          });
          return;
        }
        if (response.status === 429) {
          setFeedback({
            message: 'Please wait a minute before trying again.',
            retry: null,
            wait: true,
          });
          return;
        }
        throw new Error();
      }
      const data = await response.json();
      if (typeof data.active !== 'boolean') throw new Error();
      setState((current) => ({
        ...current!,
        [action === 'subscription' ? 'subscribed' : 'recommended']: data.active,
      }));
    } catch {
      setFeedback({
        message:
          action === 'subscription'
            ? active
              ? 'Couldn’t unsubscribe.'
              : 'Couldn’t subscribe.'
            : active
              ? 'Couldn’t withdraw the recommendation.'
              : 'Couldn’t recommend this writing.',
        retry: 'action',
      });
    } finally {
      setPending(null);
    }
  }

  async function signOut() {
    restoreActionFocus.current = true;
    setPending('logout');
    setFeedback(null);
    try {
      const response = await fetch('/api/atproto/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error('Sign-out failed. Try again.');
      setState({ enabled: true, ready: true, signedIn: false });
    } catch {
      setFeedback({ message: 'Couldn’t sign out.', retry: 'logout' });
    } finally {
      setPending(null);
    }
  }

  const available = state?.enabled && state.ready;
  if (!available) return null;
  const retryAction = feedback && feedback.retry !== 'logout';
  return (
    <div className={styles.root} data-standard-social={action}>
      {available && (
        <div
          className={styles.actions}
          data-split={split || undefined}
          data-active={Boolean(active)}
        >
          <button
            ref={actionButton}
            type="button"
            className={styles.action}
            disabled={busy || Boolean(retryAction && feedback.retry === null)}
            aria-pressed={Boolean(active)}
            aria-busy={busy}
            aria-label={
              retryAction && feedback.retry !== null
                ? `Try again to ${action === 'subscription' ? (active ? 'unsubscribe' : 'subscribe') : active ? 'withdraw the recommendation' : 'recommend this writing'}`
                : undefined
            }
            aria-haspopup={state?.signedIn ? undefined : 'dialog'}
            aria-controls={id}
            title={
              retryAction
                ? feedback.message
                : active
                  ? action === 'subscription'
                    ? 'Unsubscribe'
                    : 'Withdraw recommendation'
                  : undefined
            }
            onClick={toggle}
          >
            {pending === 'action' ? (
              <span className={styles.spinner} aria-hidden="true" />
            ) : (
              <Icon
                name={
                  action === 'subscription'
                    ? active
                      ? 'check'
                      : 'rss'
                    : 'heart'
                }
                size={17}
              />
            )}
            <span>
              {pending === 'action'
                ? action === 'subscription'
                  ? active
                    ? 'Unsubscribing…'
                    : 'Subscribing…'
                  : active
                    ? 'Withdrawing…'
                    : 'Recommending…'
                : retryAction
                  ? feedback.wait
                    ? 'Wait a moment'
                    : feedback.retry === null
                      ? 'Unavailable'
                      : 'Try again'
                  : active
                    ? action === 'subscription'
                      ? 'Subscribed'
                      : 'Recommended'
                    : label}
            </span>
          </button>
          {split && (
            <Popover
              label="Subscription options"
              disabled={pending === 'action'}
              trigger={<Icon name="chevron-down" size={20} />}
              triggerClassName={styles.arrow}
              panelClassName={styles.menu}
              align="end"
              width={156}
            >
              <button
                ref={logoutButton}
                type="button"
                disabled={busy}
                className={styles.signOut}
                title={
                  feedback?.retry === 'logout' ? feedback.message : undefined
                }
                aria-label={
                  feedback?.retry === 'logout'
                    ? 'Try again to sign out'
                    : undefined
                }
                onClick={signOut}
              >
                {pending === 'logout' ? (
                  <span className={styles.spinner} aria-hidden="true" />
                ) : (
                  <Icon name="log-out" size={18} />
                )}
                {pending === 'logout'
                  ? 'Signing out…'
                  : feedback?.retry === 'logout'
                    ? 'Try again'
                    : 'Sign out'}
              </button>
            </Popover>
          )}
        </div>
      )}
      <dialog
        ref={dialog}
        id={id}
        className={styles.dialog}
        aria-labelledby={id + '-title'}
        aria-describedby={id + '-description'}
        onCancel={dismissSignIn}
        onClose={dismissSignIn}
        {...backdrop}
      >
        <div className={styles.dialogHeading}>
          <span className={styles.dialogIcon}>
            <Icon
              name={action === 'subscription' ? 'rss' : 'heart'}
              size={23}
            />
          </span>
          <button
            type="button"
            className={styles.close}
            aria-label="Cancel"
            onClick={dismissSignIn}
          >
            <Icon name="x" size={20} />
          </button>
        </div>
        <h2 id={id + '-title'} className={styles.title}>
          {action === 'subscription'
            ? 'Follow my writing.'
            : 'Recommend this writing.'}
        </h2>
        <p id={id + '-description'} className={styles.description}>
          {action === 'subscription'
            ? 'Subscribe with an account you already use.'
            : 'Recommend it with an account you already use.'}
        </p>
        <form
          method="post"
          action="/api/atproto/login"
          onSubmit={beginSignIn}
          className={styles.form}
        >
          <input type="hidden" name="action" value={action} />
          {slug && <input type="hidden" name="slug" value={slug} />}
          <div>
            <label className={styles.label} htmlFor={id + '-handle'}>
              Your handle
            </label>
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
              className={styles.input}
              aria-invalid={loginInvalid}
              aria-describedby={
                loginError && loginInvalid ? id + '-error' : undefined
              }
            />
            {loginError && loginInvalid && signIn && (
              <span
                id={id + '-error'}
                role="alert"
                className={styles.fieldError}
              >
                {loginError}
              </span>
            )}
          </div>
          {loginError && !loginInvalid && (
            <span role="alert" id={id + '-login-error'} className="sr-only">
              {loginError}
            </span>
          )}
          <button
            type="submit"
            disabled={busy}
            className={styles.continue}
            title={loginError && !loginInvalid ? loginError : undefined}
            aria-describedby={
              loginError && !loginInvalid ? id + '-login-error' : undefined
            }
          >
            {busy
              ? 'Connecting…'
              : loginError && !loginInvalid
                ? 'Try again'
                : 'Continue'}{' '}
            <Icon name="arrow-right" size={18} />
          </button>
        </form>
      </dialog>
      {feedback && !signIn && (
        <span role="alert" className="sr-only">
          {feedback.message}
        </span>
      )}
    </div>
  );
}
