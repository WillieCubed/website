'use client';
import { useEffect, useRef, useState } from 'react';

import type { ComponentProposal, Draft, Generation } from '@/lib/studio/types';

import StudioRuntimePicker from './StudioRuntimePicker';
import { studioRequest } from './api';
import { useWidgetGeneration } from './useWidgetGeneration';

interface StudioWidgetGeneratorProps {
  documentId: string;
  revisionId: string;
  save: () => Promise<boolean>;
  onApproved: (proposal: ComponentProposal) => Promise<void>;
}

export default function StudioWidgetGenerator({
  documentId,
  revisionId,
  save,
  onApproved,
}: StudioWidgetGeneratorProps) {
  const { prompt, editPrompt } = useWidgetPrompt(documentId, revisionId);
  const { generation, connectionError, acceptGeneration } =
    useWidgetGeneration(documentId);
  const [message, setMessage] = useState('');
  const [requestBusy, setBusy] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const proposalReview = useWidgetProposal(generation, setMessage);
  const busy = requestBusy || proposalReview.busy;
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
      acceptGeneration(next);
      proposalReview.clear();
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
      acceptGeneration(result);
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
            onChange={(event) => editPrompt(event.target.value)}
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
        {message || connectionError}
      </p>
      {generation && (
        <GenerationResult
          generation={generation}
          busy={busy}
          runtimeReady={runtimeReady}
          buildComponent={proposalReview.build}
          decide={decide}
        />
      )}
      {proposalReview.proposal && (
        <WidgetProposalPreview
          proposal={proposalReview.proposal}
          busy={busy}
          approve={proposalReview.approve}
          onApproved={onApproved}
        />
      )}
    </section>
  );
}

interface GenerationResultProps {
  generation: Generation;
  busy: boolean;
  runtimeReady: boolean;
  buildComponent: () => void;
  decide: (action: 'reject' | 'retry') => void;
}

function GenerationResult({
  generation,
  busy,
  runtimeReady,
  buildComponent,
  decide,
}: GenerationResultProps) {
  return (
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
          Date.parse(generation.startedAt ?? '') < Date.now() - 180_000)) && (
        <button
          className="feeds-button"
          disabled={busy || !runtimeReady}
          onClick={() => decide('retry')}
        >
          Retry request
        </button>
      )}
    </div>
  );
}

/** Approval owns its proposal and operation state; generation requests share its busy signal. */
function useWidgetProposal(
  generation: Generation | null,
  setMessage: (message: string) => void
) {
  const [proposal, setProposal] = useState<ComponentProposal | null>(null);
  const [busy, setBusy] = useState(false);
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
  return {
    proposal,
    busy,
    build: buildComponent,
    approve,
    clear: () => setProposal(null),
  };
}

interface WidgetProposalPreviewProps {
  proposal: ComponentProposal;
  busy: boolean;
  approve: () => void;
  onApproved: (proposal: ComponentProposal) => Promise<void>;
}

function WidgetProposalPreview({
  proposal,
  busy,
  approve,
  onApproved,
}: WidgetProposalPreviewProps) {
  return (
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
  );
}

/** Keep the widget request draft in browser storage across task switches and reloads. */
function useWidgetPrompt(documentId: string, revisionId: string) {
  const requestKey = `studio-request:${documentId}`;
  const [restored, setRestored] = useState(false);
  const restoredRequest = useRef(false);
  const [prompt, setPrompt] = useState('');
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
  return { prompt, editPrompt: setPrompt };
}
