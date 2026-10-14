'use client';
import Icon from '@/components/icons/Icon';

import styles from './StandardSocialControls.module.css';
import type {
  StandardSocialProps,
  useStandardSocialControls,
} from './useStandardSocialControls';

type Props = Pick<StandardSocialProps, 'action' | 'slug'> & {
  control: ReturnType<typeof useStandardSocialControls>;
};
export default function StandardSignInDialog({ action, slug, control }: Props) {
  const {
    busy,
    signIn,
    loginError,
    loginInvalid,
    id,
    dialog,
    dismissSignIn,
    beginSignIn,
    backdrop,
  } = control;
  return (
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
          <Icon name={action === 'subscription' ? 'rss' : 'heart'} size={23} />
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
            <span id={id + '-error'} role="alert" className={styles.fieldError}>
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
  );
}
