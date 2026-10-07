'use client';

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';

import Icon from '@/components/icons/Icon';
import Popover from '@/components/site/Popover';
import { useBackdropDismiss } from '@/components/site/useBackdropDismiss';

import styles from './StandardSocialControls.module.css';

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

export default function StandardSocialControls({ action, slug }: Props) {
  const [state, setState] = useState<SocialState | null>(null);
  const [signIn, setSignIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const actionButton = useRef<HTMLButtonElement>(null);
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
    setBusy(false);
    setSignIn(false);
  }

  useEffect(() => {
    if (!busy && restoreActionFocus.current) {
      restoreActionFocus.current = false;
      actionButton.current?.focus();
    }
  }, [busy, state?.signedIn]);

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
    const controller = new AbortController();
    loginRequest.current?.abort();
    loginRequest.current = controller;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/atproto/login', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok)
        throw new Error(result.error ?? 'Sign-in did not start. Try again.');
      window.location.assign(result.url);
    } catch (problem) {
      if (controller.signal.aborted) return;
      setError(
        problem instanceof Error ? problem.message : 'Sign-in did not start.'
      );
      setBusy(false);
    } finally {
      if (loginRequest.current === controller) loginRequest.current = null;
    }
  }

  async function toggle() {
    if (!state?.signedIn) {
      setError('');
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
    restoreActionFocus.current = true;
    setBusy(true);
    setError('');
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
    <div className={styles.root} data-standard-social={action}>
      <div
        className={styles.actions}
        data-split={split || undefined}
        data-active={Boolean(active)}
      >
        <button
          ref={actionButton}
          type="button"
          className={styles.action}
          disabled={busy || !state}
          aria-pressed={Boolean(active)}
          aria-haspopup={state?.signedIn ? undefined : 'dialog'}
          aria-controls={id}
          title={
            active
              ? action === 'subscription'
                ? 'Unsubscribe'
                : 'Withdraw recommendation'
              : undefined
          }
          onClick={toggle}
        >
          <Icon
            name={
              action === 'subscription' ? (active ? 'check' : 'rss') : 'heart'
            }
            size={17}
          />
          <span>
            {active
              ? action === 'subscription'
                ? 'Subscribed'
                : 'Recommended'
              : label}
          </span>
        </button>
        {split && (
          <Popover
            label="Subscription options"
            disabled={busy}
            trigger={<Icon name="chevron-down" size={20} />}
            triggerClassName={styles.arrow}
            panelClassName={styles.menu}
            align="end"
            width={156}
          >
            <button
              type="button"
              disabled={busy}
              className={styles.signOut}
              onClick={(event) => {
                event.currentTarget
                  .closest<HTMLElement>('[popover]')
                  ?.hidePopover();
                void signOut();
              }}
            >
              <Icon name="log-out" size={18} />
              Sign out
            </button>
          </Popover>
        )}
      </div>
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
          <label className={styles.label} htmlFor={id + '-handle'}>
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
              className={styles.input}
            />
          </label>
          {error && signIn && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={styles.continue}>
            {busy ? 'Connecting…' : 'Continue'}{' '}
            <Icon name="arrow-right" size={18} />
          </button>
        </form>
      </dialog>
      {error && !signIn && (
        <p role="alert" className={styles.error}>
          {error}
          {!state && (
            <button
              type="button"
              className={styles.retry}
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
