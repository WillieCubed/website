'use client';

import { useState } from 'react';

import { WEBMENTION_ENDPOINT } from '@/lib/indieweb/constants';

/**
 * Replies written on another site arrive as webmentions. This form sends
 * one by hand for people whose site does not send them itself.
 */
export default function WebmentionForm({ target }: { target: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>(
    'idle'
  );

  return (
    <form
      className="flex flex-wrap items-end gap-2"
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
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-label-medium text-muted">
        Replied on your own site? Paste the URL
        <input
          name="source"
          type="url"
          required
          placeholder="https://"
          className="min-w-0 rounded-full border border-line bg-card px-4 py-2 text-body-medium text-ink"
        />
      </label>
      <button
        type="submit"
        disabled={state === 'sending'}
        className="rounded-full bg-accent px-4 py-2 text-label-large font-semibold text-white disabled:opacity-60"
      >
        Send
      </button>
      <span role="status" className="basis-full text-label-medium text-muted">
        {state === 'sent' && 'Received. It shows up here once it is checked.'}
        {state === 'failed' &&
          'That did not go through. Check the URL and try again.'}
      </span>
    </form>
  );
}
