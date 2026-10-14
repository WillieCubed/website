'use client';

import Icon from '@/components/icons/Icon';
import Popover from '@/components/site/Popover';

import StandardSignInDialog from './StandardSignInDialog';
import styles from './StandardSocialControls.module.css';
import { useStandardSocialControls } from './useStandardSocialControls';

interface Props {
  action: 'subscription' | 'recommendation';
  slug?: string;
  compact?: boolean;
}

export default function StandardSocialControls({
  action,
  slug,
  compact = false,
}: Props) {
  const control = useStandardSocialControls({ action, slug });
  const {
    busy,
    state,
    signIn,
    pending,
    feedback,
    id,
    actionButton,
    logoutButton,
    active,
    label,
    split,
    toggle,
    signOut,
  } = control;
  const available = state?.enabled && state.ready;
  if (!available) return null;
  const retryAction = feedback && feedback.retry !== 'logout';
  return (
    <div
      className={`${styles.root} ${compact ? styles.compact : ''}`}
      data-standard-social={action}
    >
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
            data-retry={compact && retryAction ? true : undefined}
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
                  : compact
                    ? label
                    : undefined
            }
            onClick={toggle}
          >
            {pending === 'action' ? (
              <span className={styles.spinner} aria-hidden="true" />
            ) : (
              <Icon
                name={
                  compact && retryAction
                    ? 'repeat'
                    : action === 'subscription'
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
              trigger={<Icon name="chevron-down" size={22} />}
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
      <StandardSignInDialog action={action} slug={slug} control={control} />
      {feedback && !signIn && (
        <span role="alert" className="sr-only">
          {feedback.message}
        </span>
      )}
    </div>
  );
}
