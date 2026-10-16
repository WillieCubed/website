'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { fetchWithDeadline } from '@/lib/http/fetch';

interface ImportWritingProps {
  slug: string;
}

export default function ImportWriting({ slug }: ImportWritingProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function openEditor() {
    setPending(true);
    setError('');
    try {
      const response = await fetchWithDeadline('/api/studio/documents', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceSlug: slug }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || 'The writing could not open for editing.'
        );
      router.push(`/studio/${encodeURIComponent(data.id)}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'The writing could not open for editing.'
      );
      setPending(false);
    }
  }
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        style={{ minWidth: 130 }}
        onClick={openEditor}
        className="link-animated text-label-large text-accent disabled:opacity-60"
      >
        {pending ? 'Opening editor…' : 'Edit writing'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-body-small">
          {error}
        </p>
      )}
    </div>
  );
}
