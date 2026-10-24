'use client';

import readingTime from 'reading-time';

import type { ComponentProposal, Draft, Revision } from '@/lib/studio/types';

import {
  StudioCatalogContext,
  StudioCatalogStatusContext,
} from './StudioNodeViews';
import { StudioSaveContext } from './StudioSaveContext';
import WritingCanvas from './WritingCanvas';
import WritingControls from './WritingControls';
import WritingDraftLayout from './WritingDraftLayout';
import WritingNotices from './WritingNotices';
import WritingPublicationNotice from './WritingPublicationNotice';
import WritingReview from './WritingReview';
import WritingTasks from './WritingTasks';
import type { WritingCatalog } from './useWritingCatalog';
import { useWritingDocument } from './useWritingDocument';
import { useWritingInteraction } from './useWritingInteraction';
import { useWritingPublication } from './useWritingPublication';
import type { WritingPreviewMode } from './writing-contracts';
import { proseText } from './writingText';

export interface WritingProps {
  initial: Draft;
  onReady: () => void;
  interactive: boolean;
  catalog: WritingCatalog;
}

export default function Writing({
  initial,
  onReady,
  interactive,
  catalog,
}: WritingProps) {
  const document = useWritingDocument(initial);
  const interaction = useWritingInteraction(
    document,
    catalog.readEntries,
    onReady,
    interactive
  );
  const publication = useWritingPublication(document);
  async function generatePreview(
    nextMode: WritingPreviewMode,
    publishing = false
  ) {
    interaction.rememberRange();
    if (await publication.preparePreview(publishing))
      interaction.showPreview(nextMode);
  }
  function returnToWriting() {
    publication.dismissReview();
    interaction.returnToWriting();
  }
  function restoreRevision(revision: Revision) {
    interaction.replaceDocument(revision.body);
    returnToWriting();
  }
  async function insertApproved(proposal: ComponentProposal) {
    try {
      interaction.insert(await catalog.resolveApproved(proposal));
    } catch (error) {
      document.reportStatus((error as Error).message);
    }
  }
  const published = String(
    document.body.frontmatter?.published || document.draft.head.createdAt
  );
  const minutes = Math.ceil(
    readingTime(proseText(document.body.document)).minutes
  );
  const control = 'site-button site-button-surface';
  const { status } = document;
  const { task, mode } = interaction;
  return (
    <StudioCatalogContext.Provider value={catalog.entries}>
      <StudioCatalogStatusContext.Provider
        value={{ message: catalog.status, retry: catalog.retry }}
      >
        <StudioSaveContext.Provider value={status}>
          <WritingNotices
            conflict={document.conflict}
            recovery={Boolean(document.recovery)}
            onRecover={() =>
              document.recoverChanges(interaction.replaceDocument)
            }
            onDiscard={document.discardRecovery}
            onRebase={document.rebaseChanges}
          />
          <WritingDraftLayout
            body={document.body}
            savedRevisionId={document.draft.head.id}
            liveRevisionId={document.draft.liveRevisionId}
            update={document.update}
            dirty={document.dirty}
            status={document.status}
            hidden={mode !== 'write'}
            published={published}
            minutes={minutes}
            controls={
              <WritingControls
                conflict={document.conflict}
                recovery={Boolean(document.recovery)}
                busy={publication.busy}
                editor={interaction.editor}
                openTask={interaction.openTask}
                closePopover={interaction.closePopover}
                history={() => interaction.openTask('history')}
                save={document.save}
                generatePreview={generatePreview}
                control={control}
              />
            }
          >
            <WritingTasks
              documentId={document.draft.id}
              slug={document.draft.slug}
              revisionId={document.draft.head.id}
              task={interaction.task}
              taskHeading={interaction.taskHeading}
              body={document.body}
              update={document.update}
              returnToWriting={returnToWriting}
              onRestore={restoreRevision}
              onApproved={insertApproved}
              save={document.save}
              catalogStatus={catalog.status}
              retryCatalog={catalog.retry}
            />
            <WritingCanvas
              catalog={catalog.entries}
              cursor={interaction.cursor}
              insertAnchor={interaction.insertAnchor}
              insertionRect={interaction.insertionRect}
              taskRange={interaction.taskRange}
              selection={interaction.selection}
              editor={interaction.editor}
              rememberRange={interaction.rememberRange}
              openTask={interaction.openTask}
              returnToWriting={returnToWriting}
              insert={interaction.insert}
              control={control}
              setStatus={document.reportStatus}
              visible={task === 'write' && mode === 'write'}
            />
          </WritingDraftLayout>
          {mode !== 'write' && (
            <WritingReview
              slug={document.draft.slug}
              reviewedRevision={publication.reviewedRevision}
              body={document.body}
              status={document.status}
              conflict={document.conflict}
              mode={mode}
              onViewChange={interaction.showPreview}
              preview={publication.preview}
              review={publication.review}
              busy={publication.busy}
              returnToWriting={returnToWriting}
              publish={publication.publish}
              published={published}
              minutes={minutes}
            />
          )}
          <WritingPublicationNotice
            documentId={document.draft.id}
            slug={document.draft.slug}
            submittedPublication={publication.submittedPublication}
            onLive={document.refreshPublicationMetadata}
            busy={publication.busy}
            onReview={() => generatePreview('read', true)}
          />
        </StudioSaveContext.Provider>
      </StudioCatalogStatusContext.Provider>
    </StudioCatalogContext.Provider>
  );
}
