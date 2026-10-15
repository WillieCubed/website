'use client';

import { type RefObject, useEffect, useId, useRef, useState } from 'react';

import { fetchWithDeadline } from '@/lib/http/fetch';

import {
  type SocialAction,
  type SocialFeedback,
  type SocialState,
  actionFailure,
  actionResponseFeedback,
  returnFeedback,
  socialActions,
} from './standard-social';

const SIGNED_OUT: SocialState = { enabled: true, ready: true, signedIn: false };

/** The confirmed state and actions presented by a social control. */
export interface StandardSocialController {
  state: SocialState | null;
  available: boolean;
  signIn: boolean;
  pending: 'action' | 'logout' | null;
  feedback: SocialFeedback | null;
  busy: boolean;
  announcement: string;
  id: string;
  actionButton: RefObject<HTMLButtonElement | null>;
  logoutButton: RefObject<HTMLButtonElement | null>;
  active: boolean;
  dismissSignIn(): void;
  toggle(): Promise<void>;
  signOut(): Promise<void>;
}

/** Owns confirmed social state, requests, feedback, and action focus. */
export function useStandardSocialControls({
  action,
  slug,
}: {
  action: SocialAction;
  slug?: string;
}): StandardSocialController {
  const [state, setState] = useState<SocialState | null>(null);
  const [signIn, setSignIn] = useState(false);
  const [pending, setPending] = useState<'action' | 'logout' | null>(null);
  const [feedback, setFeedback] = useState<SocialFeedback | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const actionButton = useRef<HTMLButtonElement>(null);
  const logoutButton = useRef<HTMLButtonElement>(null);
  const restoreActionFocus = useRef(false);
  const id = useId();
  const busy = pending !== null;
  const stateKey = socialActions[action].stateKey;
  const active = Boolean(state?.[stateKey]);

  useEffect(() => {
    if (busy || signIn || !restoreActionFocus.current) return;
    restoreActionFocus.current = false;
    const logout = logoutButton.current;
    if (
      feedback?.retry === 'logout' &&
      logout?.closest('[popover]')?.matches(':popover-open')
    ) {
      logout.focus();
    } else {
      actionButton.current?.focus();
    }
  }, [busy, signIn, state?.signedIn, feedback]);

  useEffect(() => {
    if (!feedback?.wait) return;
    const timer = setTimeout(() => setFeedback(null), 60_000);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    const controller = new AbortController();
    const returning = new URL(window.location.href).searchParams.has(
      'atprotoError'
    );
    function finishReturn(feedback: SocialFeedback | null) {
      if (!returning || controller.signal.aborted) return;
      const url = new URL(window.location.href);
      url.searchParams.delete('atprotoError');
      window.history.replaceState(window.history.state, '', url.href);
      setFeedback(feedback);
    }
    async function load() {
      try {
        const query = slug ? '?slug=' + encodeURIComponent(slug) : '';
        const response = await fetchWithDeadline(
          '/api/atproto/social' + query,
          {
            signal: controller.signal,
            cache: 'no-store',
          }
        );
        const data: SocialState = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok && response.status !== 401)
          throw new Error('Social state unavailable.');
        const current = response.status === 401 ? SIGNED_OUT : data;
        setState(current);
        finishReturn(returnFeedback(action, current));
      } catch {
        finishReturn({ message: 'That action did not finish.', retry: null });
      }
    }
    void load();
    return () => controller.abort();
  }, [action, slug]);

  function requestSignIn() {
    setFeedback(null);
    setSignIn(true);
  }

  function dismissSignIn() {
    restoreActionFocus.current = true;
    setSignIn(false);
  }

  async function toggle() {
    if (!state?.signedIn) return requestSignIn();
    restoreActionFocus.current = true;
    setPending('action');
    setAnnouncement(actionAnnouncement(action, active, true));
    setFeedback(null);
    try {
      const response = await fetchWithDeadline('/api/atproto/' + action, {
        method: active ? 'DELETE' : 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      if (response.status === 401) {
        setState(SIGNED_OUT);
        requestSignIn();
        return;
      }
      if (!response.ok) {
        const failure = actionResponseFeedback(action, response.status);
        if (!failure) throw new Error('Social action failed.');
        setFeedback(failure);
        return;
      }
      const data = await response.json();
      if (typeof data.active !== 'boolean')
        throw new Error('Missing confirmed social state.');
      setAnnouncement(actionAnnouncement(action, data.active, false));
      setState((current) => current && { ...current, [stateKey]: data.active });
    } catch {
      setAnnouncement('');
      setFeedback(actionFailure(action, active));
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
      if (!response.ok) throw new Error('Sign-out failed.');
      setAnnouncement('Signed out.');
      setState(SIGNED_OUT);
    } catch {
      setAnnouncement('');
      setFeedback({ message: 'Couldn’t sign out.', retry: 'logout' });
    } finally {
      setPending(null);
    }
  }

  return {
    announcement,
    state,
    available: Boolean(state?.enabled && state.ready),
    signIn,
    pending,
    feedback,
    busy,
    id,
    actionButton,
    logoutButton,
    active,
    dismissSignIn,
    toggle,
    signOut,
  };
}

function actionAnnouncement(
  action: SocialAction,
  active: boolean,
  pending: boolean
): string {
  if (pending) {
    if (action === 'subscription')
      return active ? 'Unsubscribing…' : 'Subscribing…';
    return active ? 'Withdrawing recommendation…' : 'Recommending…';
  }
  if (action === 'subscription')
    return active ? 'Subscribed.' : 'Unsubscribed.';
  return active ? 'Recommended.' : 'Recommendation withdrawn.';
}
