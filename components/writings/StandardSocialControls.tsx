'use client';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import LoadingIndicator from '@/components/site/LoadingIndicator';
import Popover from '@/components/site/Popover';

import { site } from '@/lib/site/identity';

import StandardSignInDialog from './StandardSignInDialog';
import styles from './StandardSocialControls.module.css';
import { type SocialAction, socialButton } from './standard-social';
import {
  type StandardSocialController,
  useStandardSocialControls,
} from './useStandardSocialControls';

interface Props {
  action: SocialAction;
  slug?: string;
  compact?: boolean;
}

function SocialActionButton({
  action,
  compact,
  control,
}: {
  action: SocialAction;
  compact: boolean;
  control: StandardSocialController;
}) {
  const display = socialButton(
    action,
    control.active,
    control.pending === 'action',
    compact,
    control.feedback
  );
  return (
    <button
      ref={control.actionButton}
      type="button"
      className={styles.action}
      disabled={control.busy || display.blocked}
      aria-pressed={control.active}
      aria-busy={control.pending === 'action'}
      data-retry={(compact && display.retry) || undefined}
      aria-label={display.ariaLabel}
      aria-haspopup={control.state?.signedIn ? undefined : 'dialog'}
      aria-controls={control.id}
      title={display.title}
      onClick={control.toggle}
    >
      {control.pending === 'action' ? (
        <LoadingIndicator />
      ) : (
        <Icon name={display.icon} size={17} />
      )}
      <span>{display.label}</span>
    </button>
  );
}

function SubscriptionOptions({
  control,
}: {
  control: StandardSocialController;
}) {
  const failure =
    control.feedback?.retry === 'logout' ? control.feedback : null;
  let label = failure ? 'Try again' : 'Sign out';
  if (control.pending === 'logout') label = 'Signing out…';
  return (
    <Popover
      label="Subscription options"
      disabled={control.pending === 'action'}
      trigger={<Icon name="chevron-down" size={22} />}
      triggerClassName={styles.arrow}
      panelClassName={styles.menu}
      align="end"
      width={156}
    >
      <button
        ref={control.logoutButton}
        type="button"
        disabled={control.busy}
        aria-busy={control.pending === 'logout'}
        className={styles.signOut}
        title={failure?.message}
        aria-label={failure ? 'Try again to sign out' : undefined}
        onClick={control.signOut}
      >
        {control.pending === 'logout' ? (
          <LoadingIndicator />
        ) : (
          <Icon name="log-out" size={18} />
        )}
        {label}
      </button>
    </Popover>
  );
}

export default function StandardSocialControls({
  action,
  slug,
  compact = false,
}: Props) {
  const control = useStandardSocialControls({ action, slug });
  return (
    <div
      className={`${styles.root} ${compact ? styles.compact : ''}`}
      data-standard-social={action}
    >
      <SocialActions
        action={action}
        slug={slug}
        compact={compact}
        control={control}
      />
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

function SocialActions({
  action,
  slug,
  compact,
  control,
}: Props & { compact: boolean; control: StandardSocialController }) {
  if (!control.available) return <SocialFallback action={action} slug={slug} />;
  const split = control.state?.signedIn && action === 'subscription';
  return (
    <div
      className={styles.actions}
      data-split={split || undefined}
      data-active={control.active}
    >
      <SocialActionButton action={action} compact={compact} control={control} />
      {split && <SubscriptionOptions control={control} />}
    </div>
  );
}

function SocialFallback({
  action,
  slug,
}: {
  action: SocialAction;
  slug?: string;
}) {
  const subscription = action === 'subscription';
  return (
    <div className={styles.actions}>
      <SiteLink
        preview={false}
        className={styles.action}
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
