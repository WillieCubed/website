'use client';

import { useEffect, useState } from 'react';

import SiteLink from '@/components/link/SiteLink';
import Button from '@/components/site/Button';
import SharedTitle from '@/components/site/SharedTitle';
import TopBar from '@/components/site/TopBar';

import { formatDate } from '@/lib/site/dates';
import type { Draft, EditorNode } from '@/lib/studio/types';

import NewWriting from './NewWriting';
import { studioRequest } from './api';

interface StudioDocumentsResponse {
  documents: Draft[];
}

interface WritingCardIdentity {
  state: string;
  identity: string;
}

function noteExcerpt(node: EditorNode): string {
  const text = node.text ?? (node.content ?? []).map(noteExcerpt).join(' ');
  return text.replace(/\s+/g, ' ').trim();
}

type StudioLibraryStatus = 'loading' | 'ready' | 'failed';

export default function StudioLibrary() {
  const [documents, setDocuments] = useState<Draft[]>([]);
  const [status, setStatus] = useState<StudioLibraryStatus>('loading');
  async function load(signal?: AbortSignal) {
    setStatus('loading');
    try {
      const data = await studioRequest<StudioDocumentsResponse>('/documents', {
        signal,
      });
      if (!signal?.aborted) {
        setDocuments(data.documents);
        setStatus('ready');
      }
    } catch {
      if (!signal?.aborted) {
        setStatus('failed');
      }
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, []);
  let message = `${documents.length} ${documents.length === 1 ? 'writing' : 'writings'}`;
  if (status === 'loading') message = 'Loading your writings…';
  if (status === 'failed') message = 'Your writings could not load. Try again.';
  return (
    <>
      <TopBar
        column="content"
        crumbs={[{ label: 'Your writings', href: '/studio' }]}
      />
      <main
        id="main"
        className="writing-studio mx-auto site-frame site-frame--content pb-8"
      >
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-4">
            <h1 className="text-headline-medium medium:text-display-small">
              Your writings
            </h1>
            <NewWriting />
          </div>
          <p className="mt-3 text-body-medium text-muted">
            <SiteLink
              href="/writings"
              preview={false}
              className="link-animated text-ink"
            >
              Browse the website
            </SiteLink>
            <span aria-hidden="true"> · </span>
            <SiteLink
              href="/studio/music"
              preview={false}
              className="link-animated text-ink"
            >
              Curate music
            </SiteLink>
          </p>
        </section>
        <p
          role="status"
          aria-live="polite"
          className="mt-3 min-h-6 text-body-medium text-muted"
        >
          {message}
        </p>
        {status === 'failed' && (
          <Button onClick={() => void load()}>Try again</Button>
        )}
        <noscript>
          <p>
            This editor needs JavaScript. You can still{' '}
            <SiteLink href="/writings">read your writings</SiteLink>.
          </p>
        </noscript>
        <section
          aria-label="Your writings"
          aria-busy={status === 'loading'}
          className="space-y-3 pb-6 pt-2"
          style={{ minHeight: 440 }}
        >
          {status === 'loading' && documents.length === 0 && (
            <WritingCardsPlaceholder />
          )}
          {documents.map((draft) => (
            <WritingCard key={draft.id} draft={draft} />
          ))}
          {status === 'ready' && documents.length === 0 && (
            <p className="text-body-large text-muted">
              No working copies yet. Start a writing, or open a published
              writing to edit it.
            </p>
          )}
        </section>
      </main>
    </>
  );
}

function writingCardIdentity(draft: Draft): WritingCardIdentity {
  const state =
    draft.liveRevisionId === draft.head.id
      ? 'Published'
      : draft.liveRevisionId
        ? 'Unpublished changes'
        : 'Draft';
  const identity = writingCardTitle(draft);
  return { state, identity };
}

function writingCardTitle(draft: Draft): string {
  const excerpt =
    noteExcerpt(draft.head.body.document) ||
    draft.head.body.description ||
    draft.head.body.title ||
    (draft.head.body.postType === 'note'
      ? 'Untitled note'
      : 'Untitled writing');
  const sentence = excerpt.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? excerpt;
  const identity =
    (draft.head.body.postType === 'article' && draft.head.body.title) ||
    (sentence.length > 120 ? `${sentence.slice(0, 117).trimEnd()}…` : sentence);

  return identity;
}

interface WritingCardProps {
  draft: Draft;
}

function WritingCard({ draft }: WritingCardProps) {
  const { state, identity } = writingCardIdentity(draft);
  return (
    <article className="group relative -mx-3 min-h-32 rounded-2xl border border-line bg-card px-3 py-4 medium:-mx-5 medium:px-5 transition-colors hover:border-accent">
      <SiteLink
        href={`/studio/${draft.id}`}
        preview={false}
        className="absolute inset-0 z-10 rounded-2xl"
        aria-label={`Edit ${identity}`}
      />
      <div className="pointer-events-none relative space-y-2">
        {draft.head.body.postType === 'note' ? (
          <p dir="auto" className="text-body-large text-ink">
            {identity}
          </p>
        ) : (
          <>
            <h2 className="text-title-large font-semibold text-ink transition-colors group-hover:text-accent">
              <SharedTitle id={`writing-${draft.slug}`} size="small">
                <span dir="auto" className="inline-block">
                  {identity}
                </span>
              </SharedTitle>
            </h2>
            {draft.head.body.description && (
              <p dir="auto" className="text-body-medium text-muted">
                {draft.head.body.description}
              </p>
            )}
          </>
        )}
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-medium text-muted">
          <time dateTime={draft.head.createdAt}>
            {formatDate(draft.head.createdAt, 'short')}
          </time>
          <span aria-hidden="true">·</span>
          <span>{state}</span>
        </p>
      </div>
    </article>
  );
}

function WritingCardsPlaceholder() {
  return Array.from({ length: 3 }, (_, i) => (
    <article
      key={i}
      aria-hidden="true"
      className="-mx-3 min-h-32 rounded-2xl border border-line bg-card px-3 py-4 medium:-mx-5 medium:px-5"
    >
      <div className="studio-opening-line studio-opening-title" />
      <div className="studio-opening-line studio-opening-description" />
      <div className="studio-opening-line studio-opening-date" />
    </article>
  ));
}
