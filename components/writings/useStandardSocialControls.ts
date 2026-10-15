'use client';

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';

import { useBackdropDismiss } from '@/components/site/useBackdropDismiss';

import { fetchWithDeadline } from '@/lib/http/fetch';

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
export interface StandardSocialProps {
  action: 'subscription' | 'recommendation';
  slug?: string;
  compact?: boolean;
}

export function useStandardSocialControls({
  action,
  slug,
}: StandardSocialProps) {
  const [state, setState] = useState<SocialState | null>(null);
  const [signIn, setSignIn] = useState(false);
  const [pending, setPending] = useState<'action' | 'login' | 'logout' | null>(
    null
  );
  const [loginError, setLoginError] = useState('');
  const [announcement, setAnnouncement] = useState('');
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
    fetchWithDeadline('/api/atproto/social' + query, {
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
    setAnnouncement('Connecting…');
    setLoginError('');
    setLoginInvalid(false);
    try {
      const response = await fetchWithDeadline('/api/atproto/login', {
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
      setAnnouncement('Opening your account provider…');
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
    setAnnouncement(
      action === 'subscription'
        ? active
          ? 'Unsubscribing…'
          : 'Subscribing…'
        : active
          ? 'Withdrawing recommendation…'
          : 'Recommending…'
    );
    setFeedback(null);
    try {
      const response = await fetchWithDeadline('/api/atproto/' + action, {
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
      setAnnouncement(
        action === 'subscription'
          ? data.active
            ? 'Subscribed.'
            : 'Unsubscribed.'
          : data.active
            ? 'Recommended.'
            : 'Recommendation withdrawn.'
      );
      setState((current) => ({
        ...current!,
        [action === 'subscription' ? 'subscribed' : 'recommended']: data.active,
      }));
    } catch {
      setAnnouncement('');
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
    setAnnouncement('Signing out…');
    setFeedback(null);
    try {
      const response = await fetchWithDeadline('/api/atproto/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!response.ok) throw new Error('Sign-out failed. Try again.');
      setAnnouncement('Signed out.');
      setState({ enabled: true, ready: true, signedIn: false });
    } catch {
      setAnnouncement('');
      setFeedback({ message: 'Couldn’t sign out.', retry: 'logout' });
    } finally {
      setPending(null);
    }
  }

  return {
    busy,
    announcement,
    state,
    signIn,
    pending,
    loginError,
    loginInvalid,
    feedback,
    id,
    dialog,
    actionButton,
    logoutButton,
    active,
    label,
    split,
    dismissSignIn,
    beginSignIn,
    toggle,
    signOut,
    backdrop,
  };
}
