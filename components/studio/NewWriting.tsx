import { useRouter } from 'next/navigation';
import { useState } from 'react';

import Icon from '@/components/icons/Icon';
import Button from '@/components/site/Button';

import { useHydrated } from '@/lib/dom/hydrated';
import type { Draft } from '@/lib/studio/types';

import { studioRequest } from './api';

/** Creation keeps its pending operation and failure beside the initiating control. */
export default function NewWriting() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  async function create() {
    setCreating(true);
    setError('');
    try {
      const draft = await studioRequest<Draft>('/documents', {
        method: 'POST',
        body: JSON.stringify({
          slug: `untitled-${crypto.randomUUID()}`,
          body: {
            title: '',
            description: '',
            tags: [],
            postType: 'article',
            document: { type: 'doc', content: [{ type: 'paragraph' }] },
          },
        }),
      });
      router.push(`/studio/${draft.id}?compose=1`);
    } catch (failure) {
      setError((failure as Error).message);
      setCreating(false);
    }
  }
  return (
    <>
      <Button
        className="site-button site-button-surface site-button-tonal"
        type="button"
        disabled={creating || !hydrated}
        aria-busy={creating}
        style={{ minWidth: 134 }}
        onClick={() => void create()}
      >
        <Icon name="pen-line" size={16} />
        <span>{creating ? 'Opening…' : 'New writing'}</span>
      </Button>
      {creating && (
        <span className="sr-only" role="status">
          Creating your writing…
        </span>
      )}
      {error && (
        <p role="alert" className="basis-full text-body-medium text-muted">
          {error}
        </p>
      )}
    </>
  );
}
