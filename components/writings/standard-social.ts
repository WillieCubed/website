import type { IconName } from '@/components/icons/Icon';

export interface SocialState {
  enabled: boolean;
  ready: boolean;
  signedIn: boolean;
  subscribed?: boolean;
  recommended?: boolean;
}

export interface SocialFeedback {
  message: string;
  retry: 'action' | 'logout' | 'signin' | null;
  wait?: boolean;
}

export type SocialAction = 'subscription' | 'recommendation';

export const socialActions = {
  subscription: {
    stateKey: 'subscribed',
    icon: 'rss',
    heading: 'Follow my writing.',
    description: 'Subscribe with an account you already use.',
    unavailable: 'Subscriptions are unavailable right now.',
    inactive: {
      label: 'Subscribe',
      verb: 'subscribe',
      pending: 'Subscribing…',
      failure: 'Couldn’t subscribe.',
      icon: 'rss',
    },
    active: {
      label: 'Subscribed',
      verb: 'unsubscribe',
      pending: 'Unsubscribing…',
      failure: 'Couldn’t unsubscribe.',
      icon: 'check',
    },
    undo: 'Unsubscribe',
  },
  recommendation: {
    stateKey: 'recommended',
    icon: 'heart',
    heading: 'Recommend this writing.',
    description: 'Recommend it with an account you already use.',
    unavailable: 'Recommendations are unavailable right now.',
    inactive: {
      label: 'Recommend',
      verb: 'recommend this writing',
      pending: 'Recommending…',
      failure: 'Couldn’t recommend this writing.',
      icon: 'heart',
    },
    active: {
      label: 'Recommended',
      verb: 'withdraw the recommendation',
      pending: 'Withdrawing…',
      failure: 'Couldn’t withdraw the recommendation.',
      icon: 'heart',
    },
    undo: 'Withdraw recommendation',
  },
} as const;

export function actionFailure(
  action: SocialAction,
  active: boolean
): SocialFeedback {
  const copy = socialActions[action][active ? 'active' : 'inactive'];
  return { message: copy.failure, retry: 'action' };
}

export function unavailableFeedback(action: SocialAction): SocialFeedback {
  return { message: socialActions[action].unavailable, retry: null };
}

export function returnFeedback(
  action: SocialAction,
  state: SocialState
): SocialFeedback | null {
  if (!state.enabled || !state.ready) return unavailableFeedback(action);
  if (!state.signedIn)
    return { message: 'Sign-in did not finish.', retry: 'signin' };
  if (!state[socialActions[action].stateKey])
    return actionFailure(action, false);
  return null;
}

export function actionResponseFeedback(
  action: SocialAction,
  status: number
): SocialFeedback | null {
  if (status === 404 || status === 409) return unavailableFeedback(action);
  if (status === 429)
    return {
      message: 'Please wait a minute before trying again.',
      retry: null,
      wait: true,
    };
  return null;
}

function feedbackLabel(feedback: SocialFeedback): string {
  if (feedback.wait) return 'Wait a moment';
  return feedback.retry === null ? 'Unavailable' : 'Try again';
}

export interface SocialButtonDisplay {
  label: string;
  title?: string;
  icon: IconName;
  retry: boolean;
  blocked: boolean;
  ariaLabel?: string;
}

type SocialOperation = (typeof socialActions)[SocialAction][
  | 'active'
  | 'inactive'];

function retryButton(
  operation: SocialOperation,
  pending: boolean,
  compact: boolean,
  feedback: SocialFeedback
): SocialButtonDisplay {
  return {
    label: pending ? operation.pending : feedbackLabel(feedback),
    title: feedback.message,
    icon: compact ? 'repeat' : operation.icon,
    retry: true,
    blocked: feedback.retry === null,
    ariaLabel:
      feedback.retry === null ? undefined : `Try again to ${operation.verb}`,
  };
}

export function socialButton(
  action: SocialAction,
  active: boolean,
  pending: boolean,
  compact: boolean,
  feedback: SocialFeedback | null
): SocialButtonDisplay {
  const definition = socialActions[action];
  const operation = definition[active ? 'active' : 'inactive'];
  if (feedback && feedback.retry !== 'logout')
    return retryButton(operation, pending, compact, feedback);
  let title: string | undefined = compact
    ? definition.inactive.label
    : undefined;
  if (active) title = definition.undo;
  return {
    label: pending ? operation.pending : operation.label,
    title,
    icon: operation.icon,
    retry: false,
    blocked: false,
  };
}

export interface SignInError {
  field?: string;
  service?: string;
}

export function signInFailure(status: number): SignInError {
  if (status === 400 || status === 404)
    return { field: 'Check your handle and try again.' };
  if (status === 429)
    return { service: 'Please wait a minute before trying again.' };
  return {
    service: 'Sign-in is unavailable right now. Please try again later.',
  };
}
