'use client';

import type { RefObject } from 'react';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import LoadingIndicator from '@/components/site/LoadingIndicator';
import Popover from '@/components/site/Popover';

import { site } from '@/lib/site/identity';

import StandardSignInDialog from './StandardSignInDialog';
import styles from './StandardSocialControls.module.css';
import {
  type SocialAction,
  type SocialButtonDisplay,
  type SocialFeedback,
  socialButton,
} from './standard-social';
import { useStandardSocialControls } from './useStandardSocialControls';

interface Props {
  action: SocialAction;
  slug?: string;
  compact?: boolean;
}

interface SubscriptionOptionsProps {
  visible: boolean;
  pending: 'action' | 'logout' | null;
  feedback: SocialFeedback | null;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onSignOut: () => Promise<void>;
}

function SubscriptionOptions({
  visible,
  pending,
  feedback,
  buttonRef,
  onSignOut,
}: SubscriptionOptionsProps) {
  if (!visible) return null;
  const failure = feedback?.retry === 'logout' ? feedback : null;
  let label = failure ? 'Try again' : 'Sign out';
  if (pending === 'logout') label = 'Signing out…';
  return (
    <Popover
      label="Subscription options"
      disabled={pending === 'action'}
      trigger={<Icon name="chevron-down" size={22} />}
      triggerClassName={`site-control ${styles.arrow}`}
      panelClassName={styles.menu}
      align="end"
      width={156}
    >
      <button
        ref={buttonRef}
        type="button"
        disabled={pending !== null}
        aria-busy={pending === 'logout'}
        className={`site-control ${styles.signOut}`}
        title={failure?.message}
        aria-label={failure ? 'Try again to sign out' : undefined}
        onClick={onSignOut}
      >
        {pending === 'logout' ? (
          <LoadingIndicator />
        ) : (
          <Icon name="log-out" size={18} />
        )}
        {label}
      </button>
    </Popover>
  );
}

interface SocialActionButtonProps {
  display: SocialButtonDisplay;
  pending: 'action' | 'logout' | null;
  active: boolean;
  signedIn: boolean;
  compact: boolean;
  dialogId: string;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onToggle: () => Promise<void>;
}

function SocialActionButton({
  display,
  pending,
  active,
  signedIn,
  compact,
  dialogId,
  buttonRef,
  onToggle,
}: SocialActionButtonProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={`site-control ${styles.action}`}
      disabled={pending !== null || display.blocked}
      aria-pressed={active}
      aria-busy={pending === 'action'}
      data-retry={(compact && display.retry) || undefined}
      aria-label={display.ariaLabel}
      aria-haspopup={signedIn ? undefined : 'dialog'}
      aria-controls={dialogId}
      title={display.title}
      onClick={onToggle}
    >
      {pending === 'action' ? (
        <LoadingIndicator />
      ) : (
        <Icon name={display.icon} size={17} />
      )}
      <span>{display.label}</span>
    </button>
  );
}

export default function StandardSocialControls({
  action,
  slug,
  compact = false,
}: Props) {
  const control = useStandardSocialControls({ action, slug });
  const signedIn = Boolean(control.state?.signedIn);
  const split = signedIn && action === 'subscription';
  const display = socialButton(
    action,
    control.active,
    control.pending === 'action',
    compact,
    control.feedback
  );
  return (
    <div
      className={`${styles.root} ${compact ? styles.compact : ''}`}
      data-standard-social={action}
    >
      {control.available ? (
        <div
          className={styles.actions}
          data-split={split || undefined}
          data-active={control.active}
        >
          <SocialActionButton
            display={display}
            pending={control.pending}
            active={control.active}
            signedIn={signedIn}
            compact={compact}
            dialogId={control.id}
            buttonRef={control.actionButton}
            onToggle={control.toggle}
          />
          <SubscriptionOptions
            visible={split}
            pending={control.pending}
            feedback={control.feedback}
            buttonRef={control.logoutButton}
            onSignOut={control.signOut}
          />
        </div>
      ) : (
        <SocialFallback action={action} slug={slug} />
      )}
      <StandardSignInDialog
        action={action}
        slug={slug}
        id={control.id}
        open={control.signIn}
        onDismiss={control.dismissSignIn}
      />
      <span className="sr-only" role="status">
        {control.announcement}
      </span>
      {control.feedback && !control.signIn && (
        <span
          role="alert"
          className={control.available ? 'sr-only' : undefined}
        >
          {control.feedback.message}
        </span>
      )}
    </div>
  );
}

interface SocialFallbackProps {
  action: SocialAction;
  slug?: string;
}

function SocialFallback({ action, slug }: SocialFallbackProps) {
  const subscription = action === 'subscription';
  return (
    <div className={styles.actions}>
      <SiteLink
        preview={false}
        className={`site-control ${styles.action}`}
        href={
          subscription
            ? '/writings/feed.xml'
            : `https://bsky.app/intent/compose?text=${encodeURIComponent(`${site.origin}/writings/${slug ?? ''}`)}`
        }
        aria-label={subscription ? 'Subscribe by RSS' : 'Share this writing'}
      >
        <Icon name={subscription ? 'rss' : 'heart'} size={24} />
        <span>{subscription ? 'Subscribe by RSS' : 'Share writing'}</span>
      </SiteLink>
    </div>
  );
}
