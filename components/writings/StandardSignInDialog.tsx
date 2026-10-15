'use client';

import {
  type FormEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

import Icon from '@/components/icons/Icon';
import { useBackdropDismiss } from '@/components/site/useBackdropDismiss';

import { fetchWithDeadline } from '@/lib/http/fetch';

import styles from './StandardSocialControls.module.css';
import {
  type SignInError,
  type SocialAction,
  signInFailure,
  socialActions,
} from './standard-social';

interface Props {
  action: SocialAction;
  slug?: string;
  id: string;
  open: boolean;
  onDismiss: () => void;
}

interface SignInFormState {
  error: SignInError;
  pending: boolean;
  announcement: string;
  submit(event: FormEvent<HTMLFormElement>): Promise<void>;
}

interface SignInController extends SignInFormState {
  dialog: RefObject<HTMLDialogElement | null>;
  dismiss(): void;
}

/** The dialog owns its form and cancels its request when it closes. */
function useSignIn(open: boolean, onDismiss: () => void): SignInController {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const [error, setError] = useState<SignInError>({});
  const [pending, setPending] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  function dismiss() {
    request.current?.abort();
    request.current = null;
    setPending(false);
    setAnnouncement('');
    setError({});
    onDismiss();
  }

  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (!open) {
      modal.close();
      return;
    }
    modal.showModal();
    modal.querySelector<HTMLInputElement>('input[name="handle"]')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      request.current?.abort();
      request.current = null;
      modal.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = Object.fromEntries(new FormData(event.currentTarget));
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setPending(true);
    setAnnouncement('Connecting…');
    setError({});
    try {
      const response = await fetchWithDeadline('/api/atproto/login', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (response.ok) {
        setAnnouncement('Opening your account provider…');
        window.location.assign(result.url);
        return;
      }
      setError(signInFailure(response.status));
      setAnnouncement('');
      setPending(false);
    } catch {
      if (controller.signal.aborted) return;
      setError({ service: 'We couldn’t connect. Please try again.' });
      setAnnouncement('');
      setPending(false);
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  return { dialog, error, pending, announcement, submit, dismiss };
}

interface SignInFormProps {
  action: SocialAction;
  slug?: string;
  id: string;
  login: SignInFormState;
}

function SignInForm({ action, slug, id, login }: SignInFormProps) {
  const { error, pending, announcement, submit } = login;
  let label = error.service ? 'Try again' : 'Continue';
  if (pending) label = 'Connecting…';
  return (
    <form
      method="post"
      action="/api/atproto/login"
      onSubmit={submit}
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
          aria-invalid={Boolean(error.field)}
          aria-describedby={error.field ? id + '-error' : undefined}
        />
        {error.field && (
          <span id={id + '-error'} role="alert" className={styles.fieldError}>
            {error.field}
          </span>
        )}
      </div>
      {error.service && (
        <span role="alert" id={id + '-login-error'} className="sr-only">
          {error.service}
        </span>
      )}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={styles.continue}
        title={error.service}
        aria-describedby={error.service ? id + '-login-error' : undefined}
      >
        {label} <Icon name="arrow-right" size={18} />
      </button>
      <span className="sr-only" role="status">
        {announcement}
      </span>
    </form>
  );
}

export default function StandardSignInDialog({
  action,
  slug,
  id,
  open,
  onDismiss,
}: Props) {
  const login = useSignIn(open, onDismiss);
  const backdrop = useBackdropDismiss(login.dismiss);
  const copy = socialActions[action];
  return (
    <dialog
      ref={login.dialog}
      id={id}
      className={styles.dialog}
      aria-labelledby={id + '-title'}
      aria-describedby={id + '-description'}
      onCancel={login.dismiss}
      onClose={login.dismiss}
      {...backdrop}
    >
      <div className={styles.dialogHeading}>
        <span className={styles.dialogIcon}>
          <Icon name={copy.icon} size={23} />
        </span>
        <button
          type="button"
          className={styles.close}
          aria-label="Cancel"
          onClick={login.dismiss}
        >
          <Icon name="x" size={20} />
        </button>
      </div>
      <h2 id={id + '-title'} className={styles.title}>
        {copy.heading}
      </h2>
      <p id={id + '-description'} className={styles.description}>
        {copy.description}
      </p>
      <SignInForm action={action} slug={slug} id={id} login={login} />
    </dialog>
  );
}
