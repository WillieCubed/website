'use client';
import { useEffect, useRef, useState } from 'react';

import type { ComponentProposal, Draft, Generation } from '@/lib/studio/types';

import StudioRuntimePicker from './StudioRuntimePicker';
import { studioRequest } from './api';

export default function StudioWidgetGenerator({
  documentId,
  revisionId,
  save,
  onApproved,
}: {
  documentId: string;
  revisionId: string;
  save: () => Promise<boolean>;
  onApproved: (proposal: ComponentProposal) => Promise<void>;
}) {
  const requestKey = `studio-request:${documentId}`;
  const [restored, setRestored] = useState(false);
  const restoredRequest = useRef(false);
  const [prompt, setPrompt] = useState('');
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [proposal, setProposal] = useState<ComponentProposal | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  useEffect(() => {
    try {
      const retained = sessionStorage.getItem(
        `studio-generation:${documentId}`
      );
      if (retained)
        studioRequest<Generation>(`/generations/${retained}`)
          .then((value) => {
            if (value.kind === 'component') setGeneration(value);
          })
          .catch(() => {});
    } catch {
      /* Recovery is optional when browser storage is unavailable. */
    }
  }, [documentId]);
  useEffect(() => {
    if (generation) {
      try {
        sessionStorage.setItem(
          `studio-generation:${documentId}`,
          generation.id
        );
      } catch {
        /* Keep the active proposal in memory. */
      }
    }
  }, [generation, documentId]);
  useEffect(() => {
    if (!generation || !['pending', 'running'].includes(generation.status))
      return;
    const timer = setTimeout(() => {
      studioRequest<Generation>(`/generations/${generation.id}`)
        .then((value) => {
          if (value.kind === 'component') setGeneration(value);
        })
        .catch((error) => setMessage(error.message));
    }, 2500);
    return () => clearTimeout(timer);
  }, [generation]);
  useEffect(() => {
    if (restoredRequest.current) return;
    restoredRequest.current = true;
    try {
      const retained = sessionStorage.getItem(requestKey);
      if (retained) {
        const value = JSON.parse(retained);
        if (value.kind === 'component' && typeof value.prompt === 'string')
          setPrompt(value.prompt);
      }
    } catch {
      /* The request remains available in memory. */
    }
    setRestored(true);
  }, [requestKey, revisionId]);
  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(
        requestKey,
        JSON.stringify({
          prompt,
          kind: 'component',
        })
      );
    } catch {
      /* Keep the active request in memory. */
    }
  }, [restored, requestKey, prompt]);
  async function request(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (!runtimeReady) {
        setMessage(
          'Choose your personal Lovelace device before requesting a proposal.'
        );
        return;
      }
      if (!(await save())) {
        setMessage('Save your draft before requesting a proposal.');
        return;
      }
      setMessage('Generating widget…');
      const current = await studioRequest<Draft>(`/documents/${documentId}`);
      const next = await studioRequest<Generation>('/generations', {
        method: 'POST',
        body: JSON.stringify({
          documentId,
          revisionId: current.head.id,
          kind: 'component',
          prompt,
        }),
      });
      setGeneration(next);
      setProposal(null);
      setMessage('');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function decide(action: 'reject' | 'retry') {
    if (!generation) return;
    setBusy(true);
    try {
      const result = await studioRequest<Generation>(
        `/generations/${generation.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ action, expectedRevisionId: revisionId }),
        }
      );
      setGeneration(result);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function buildComponent() {
    if (!generation) return;
    setBusy(true);
    try {
      setProposal(
        await studioRequest<ComponentProposal>('/components', {
          method: 'POST',
          body: JSON.stringify({ generationId: generation.id }),
        })
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    if (!proposal) return;
    setBusy(true);
    try {
      const approved = await studioRequest<ComponentProposal>(
        `/components/${proposal.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ action: 'approve' }),
        }
      );
      setProposal(approved);
      setMessage('Widget approved. Ready to insert.');
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="studio-widget-generator">
      <form onSubmit={request}>
        <label>
          Describe the widget
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="An interactive chart with a static table for feeds…"
            required
          />
        </label>
        <details className="studio-connection" open={!runtimeReady}>
          <summary>
            {runtimeReady ? 'Personal device connected' : 'Connect Lattice'}
          </summary>
          <StudioRuntimePicker
            onReady={setRuntimeReady}
            returnTo={`/studio/${documentId}?components=1`}
          />
        </details>
        <button
          className="feeds-button"
          disabled={busy || !prompt.trim() || !runtimeReady}
        >
          Generate widget
        </button>
      </form>
      <p role="status" aria-live="polite">
        {message}
      </p>
      {generation && (
        <div className="studio-generation">
          <strong>
            {
              {
                pending: 'Preparing your request…',
                running: 'Generating widget…',
                waiting: 'Waiting for your device…',
                ready: 'Widget ready to review',
                failed: 'Your request needs attention',
                accepted: 'Proposal accepted',
                rejected: 'Proposal dismissed',
              }[generation.status]
            }
          </strong>
          {generation.error && <p>{generation.error}</p>}
          {generation.result && (
            <details className="studio-block-details">
              <summary>View device output</summary>
              <pre className="studio-proposal-text">{generation.result}</pre>
            </details>
          )}
          {generation.status === 'ready' && (
            <div>
              <button
                className="feeds-button"
                disabled={busy}
                onClick={buildComponent}
              >
                Build isolated preview
              </button>
              <button
                className="feeds-button"
                disabled={busy}
                onClick={() => decide('reject')}
              >
                Reject
              </button>
            </div>
          )}
          {(['failed', 'waiting'].includes(generation.status) ||
            (generation.status === 'running' &&
              Date.parse(generation.startedAt ?? '') <
                Date.now() - 180_000)) && (
            <button
              className="feeds-button"
              disabled={busy || !runtimeReady}
              onClick={() => decide('retry')}
            >
              Retry request
            </button>
          )}
        </div>
      )}
      {proposal && (
        <div>
          <h3>{proposal.name}</h3>
          <p>{proposal.description}</p>
          <iframe
            title="Proposed component sandbox"
            src={`/api/studio/components/${proposal.id}/sandbox`}
            sandbox="allow-scripts"
            className="studio-sandbox"
          />
          <p>{proposal.accessibility}</p>
          {proposal.status === 'approved' && (
            <button
              className="feeds-button"
              onClick={() => void onApproved(proposal)}
            >
              Insert approved component
            </button>
          )}
          {proposal.status === 'proposed' && (
            <button className="feeds-button" disabled={busy} onClick={approve}>
              Approve component for catalog
            </button>
          )}
        </div>
      )}
    </section>
  );
}
