'use client';

import { useRef, useState } from 'react';
import readingTime from 'reading-time';

import type { Draft } from '@/lib/studio/types';

import {
  StudioCatalogContext,
  StudioCatalogStatusContext,
} from './StudioNodes';
import type { CatalogEntry } from './StudioNodes';
import { StudioSaveContext } from './StudioSaveContext';
import StudioWritingLayout from './StudioWritingLayout';
import WritingCanvas from './WritingCanvas';
import WritingControls from './WritingControls';
import WritingHeading from './WritingHeading';
import WritingMetadata from './WritingMetadata';
import WritingNotices from './WritingNotices';
import WritingPublicationNotice from './WritingPublicationNotice';
import WritingReview from './WritingReview';
import WritingTasks from './WritingTasks';
import { useWritingDocument } from './useWritingDocument';
import { useWritingInteraction } from './useWritingInteraction';
import { useWritingPublication } from './useWritingPublication';
import { proseText } from './writingText';

export type WritingProps = {
  initial: Draft;
  onReady: () => void;
  interactive: boolean;
  entries: CatalogEntry[];
  catalogStatus: string;
  retryCatalog?: () => void;
};

export default function Writing({
  initial,
  entries,
  onReady,
  interactive,
  catalogStatus,
  retryCatalog,
}: WritingProps) {
  const document = useWritingDocument(initial);
  // Navigation and previews meet here; neither owns the authoritative draft.
  const publication = useWritingPublication(document, initial, () =>
    interaction.rememberRange()
  );
  const interaction = useWritingInteraction(
    document,
    entries,
    publication.mode,
    () => {
      publication.setMode('write');
      publication.setReview(false);
    },
    onReady,
    interactive
  );
  const [showHeading, setShowHeading] = useState(
    Boolean(initial.head.body.title || initial.head.body.description)
  );
  const titleField = useRef<HTMLTextAreaElement>(null);
  const published = String(
    document.body.frontmatter?.published || document.draft.head.createdAt
  );
  const minutes = Math.ceil(
    readingTime(proseText(document.body.document)).minutes
  );
  const control = 'site-button site-button-surface';
  const { body, status } = document;
  const { catalog, task } = interaction;
  const { mode } = publication;
  return (
    <StudioCatalogContext.Provider value={catalog}>
      <StudioCatalogStatusContext.Provider
        value={{ message: catalogStatus, retry: retryCatalog }}
      >
        <StudioSaveContext.Provider value={status}>
          <WritingNotices
            conflict={document.conflict}
            recovery={document.recovery}
            setRecovery={document.setRecovery}
            recoveryKey={document.recoveryKey}
            update={document.update}
            editor={interaction.editor}
            reloadHead={document.reloadHead}
          />
          <StudioWritingLayout
            hidden={mode !== 'write'}
            compact={
              !(
                body.postType === 'article' &&
                (showHeading || body.title || body.description)
              )
            }
            heading={
              <WritingHeading
                showHeading={showHeading}
                titleField={titleField}
                body={document.body}
                bodyRef={document.bodyRef}
                update={document.update}
              />
            }
            metadata={
              <WritingMetadata
                draft={document.draft}
                showHeading={showHeading}
                setShowHeading={setShowHeading}
                titleField={titleField}
                body={document.body}
                bodyRef={document.bodyRef}
                saved={document.saved}
                status={document.status}
                update={document.update}
                published={published}
                minutes={minutes}
              />
            }
            controls={
              <WritingControls
                conflict={document.conflict}
                recovery={document.recovery}
                busy={publication.busy}
                editor={interaction.editor}
                openTask={interaction.openTask}
                closePopover={interaction.closePopover}
                history={() => interaction.openTask('history')}
                save={document.save}
                generatePreview={publication.generatePreview}
                control={control}
              />
            }
          >
            <WritingTasks
              setStatus={document.setStatus}
              draft={document.draft}
              setCatalog={interaction.setCatalog}
              catalogRef={interaction.catalogRef}
              task={interaction.task}
              taskHeading={interaction.taskHeading}
              body={document.body}
              bodyRef={document.bodyRef}
              update={document.update}
              editor={interaction.editor}
              returnToWriting={interaction.returnToWriting}
              insert={interaction.insert}
              save={document.save}
              catalogStatus={catalogStatus}
              retryCatalog={retryCatalog}
            />
            <WritingCanvas
              catalog={interaction.catalog}
              cursor={interaction.cursor}
              insertAnchor={interaction.insertAnchor}
              insertionRect={interaction.insertionRect}
              taskRange={interaction.taskRange}
              selection={interaction.selection}
              editor={interaction.editor}
              rememberRange={interaction.rememberRange}
              openTask={interaction.openTask}
              returnToWriting={interaction.returnToWriting}
              insert={interaction.insert}
              closePopover={interaction.closePopover}
              control={control}
              setStatus={document.setStatus}
              visible={task === 'write' && mode === 'write'}
            />
          </StudioWritingLayout>
          {mode !== 'write' && (
            <WritingReview
              draft={document.draft}
              reviewedRevision={publication.reviewedRevision}
              body={document.body}
              status={document.status}
              conflict={document.conflict}
              mode={publication.mode}
              setMode={publication.setMode}
              preview={publication.preview}
              review={publication.review}
              busy={publication.busy}
              returnToWriting={interaction.returnToWriting}
              publish={publication.publish}
              published={published}
              minutes={minutes}
            />
          )}
          <WritingPublicationNotice
            draft={document.draft}
            publicationConnectionError={publication.publicationConnectionError}
            publication={publication.publication}
            busy={publication.busy}
            generatePreview={publication.generatePreview}
          />
        </StudioSaveContext.Provider>
      </StudioCatalogStatusContext.Provider>
    </StudioCatalogContext.Provider>
  );
}
