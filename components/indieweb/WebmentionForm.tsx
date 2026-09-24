'use client';

import { useState } from 'react';

import Icon from '@/components/icons/Icon';

import { WEBMENTION_ENDPOINT } from '@/lib/indieweb/constants';

/**
 * Replies live on the sites of the people who wrote them and arrive here
 * as webmentions. Most sites send one on their own; this form is for the
 * ones that do not.
 */
export default function WebmentionForm({ target }: { target: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>(
    'idle'
  );
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle'
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-body-medium text-muted">
          Publish a reply that links to this post, then submit its URL.
        </p>
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
          className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-label-large text-ink hover:border-accent"
        >
          <Icon name="copy" size={16} />
          {copyState === 'copied' ? 'Copied post URL' : 'Copy post URL'}
        </button>
      </div>
      {copyState === 'failed' && (
        <p role="status" className="text-label-medium text-signal">
          The post URL could not be copied.
        </p>
      )}
      <form
        className="space-y-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const source = new FormData(form).get('source');
          if (typeof source !== 'string' || !source) return;
          setState('sending');
          try {
            const response = await fetch(WEBMENTION_ENDPOINT, {
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
            className="min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-2 text-body-medium text-ink"
          />
          <button
            type="submit"
            disabled={state === 'sending'}
            className="rounded-full bg-primary px-4 py-2 text-label-large font-semibold text-on-primary disabled:opacity-60"
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
