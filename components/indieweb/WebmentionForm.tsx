'use client';

import { useState } from 'react';

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

  return (
    <form
      className="flex flex-col gap-3"
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
      <label htmlFor="webmention-source" className="text-body-medium text-ink">
        Wrote a reply to this on your own site or blog? Send me the link and it
        shows up here.
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="webmention-source"
          name="source"
          type="url"
          required
          placeholder="https://"
          className="min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-2 text-body-medium text-ink"
        />
        <button
          type="submit"
          disabled={state === 'sending'}
          className="rounded-full bg-accent px-4 py-2 text-label-large font-semibold text-white disabled:opacity-60"
        >
          Send
        </button>
      </div>
      <span role="status" className="text-label-medium text-muted">
        {state === 'sent' &&
          'Got it. Your reply appears here once the page has been checked.'}
        {state === 'failed' &&
          'That did not go through. Check the link and try again.'}
      </span>
    </form>
  );
}
