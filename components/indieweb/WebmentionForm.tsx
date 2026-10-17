'use client';

import { useState } from 'react';

import Icon from '@/components/icons/Icon';

import { fetchWithDeadline } from '@/lib/http/fetch';
import { WEBMENTION_ENDPOINT } from '@/lib/indieweb/constants';

/**
 * Replies live on the sites of the people who wrote them and arrive here
 * as webmentions. Most sites send one on their own; this form is for the
 * ones that do not.
 */
interface WebmentionFormProps {
  target: string;
}

export default function WebmentionForm({ target }: WebmentionFormProps) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>(
    'idle'
  );
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle'
  );

  return (
    <div className="space-y-5">
      <p className="text-body-medium text-muted">
        Publish a reply that links to this post, then submit its URL.{' '}
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(target);
              setCopyState('copied');
            } catch {
              setCopyState('failed');
            }
          }}
          className="site-control gap-1 px-3 align-middle text-label-large font-medium [--control-fill:var(--color-surface-container)] [--control-ink:var(--color-primary)]"
        >
          <Icon name="copy" size={14} />
          {copyState === 'copied' ? 'Copied post URL' : 'Copy post URL'}
        </button>
      </p>
      {copyState === 'failed' && (
        <p role="status" className="text-label-medium text-signal">
          The post URL could not be copied.
        </p>
      )}
      <form
        className="space-y-2"
        action={WEBMENTION_ENDPOINT}
        method="post"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const source = new FormData(form).get('source');
          if (typeof source !== 'string' || !source) return;
          setState('sending');
          try {
            const response = await fetchWithDeadline(WEBMENTION_ENDPOINT, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({ source, target }),
            });
            setState(response.ok ? 'sent' : 'failed');
            if (response.ok) form.reset();
          } catch {
            setState('failed');
          }
        }}
      >
        <input type="hidden" name="target" value={target} />
        <label
          htmlFor="webmention-source"
          className="block text-label-large font-medium text-ink"
        >
          Published reply URL
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="webmention-source"
            name="source"
            type="url"
            inputMode="url"
            autoComplete="url"
            required
            placeholder="https://your.site/reply"
            className="min-h-12 min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-2 text-body-medium text-ink"
          />
          <button
            type="submit"
            aria-busy={state === 'sending'}
            style={{ minWidth: 120 }}
            disabled={state === 'sending'}
            className="site-control px-4 py-2 text-label-large font-semibold [--control-fill:var(--color-primary)] [--control-ink:var(--color-on-primary)]"
          >
            {state === 'sending' ? 'Submitting…' : 'Submit reply'}
          </button>
        </div>
        {state !== 'idle' && state !== 'sending' && (
          <p role="status" className="text-label-medium text-muted">
            {state === 'sent'
              ? 'Reply submitted. It will appear after verification and approval.'
              : 'Submission failed. Check the URL and try again.'}
          </p>
        )}
      </form>
    </div>
  );
}
