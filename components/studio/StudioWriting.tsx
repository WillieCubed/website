'use client';

import {
  StudioCatalogContext,
  StudioCatalogStatusContext,
} from './StudioNodes';
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
import {
  type WritingProps,
  useWritingController,
} from './useWritingController';

export default function Writing(props: WritingProps) {
  const controller = useWritingController(props);
  const { catalogStatus, retryCatalog } = props;
  const { catalog, task, showHeading, body, status, mode } = controller;
  return (
    <StudioCatalogContext.Provider value={catalog}>
      <StudioCatalogStatusContext.Provider
        value={{ message: catalogStatus, retry: retryCatalog }}
      >
        <StudioSaveContext.Provider value={status}>
          <>
            <WritingNotices controller={controller} />
            {mode === 'write' ? (
              <>
                <StudioWritingLayout
                  compact={
                    !(
                      body.postType === 'article' &&
                      (showHeading || body.title || body.description)
                    )
                  }
                  heading={<WritingHeading controller={controller} />}
                  metadata={<WritingMetadata controller={controller} />}
                  controls={<WritingControls controller={controller} />}
                >
                  <WritingTasks
                    controller={controller}
                    catalogStatus={catalogStatus}
                    retryCatalog={retryCatalog}
                  />
                  <WritingCanvas
                    controller={controller}
                    visible={task === 'write'}
                  />
                </StudioWritingLayout>
              </>
            ) : (
              <WritingReview controller={controller} />
            )}
            <WritingPublicationNotice controller={controller} />
          </>
        </StudioSaveContext.Provider>
      </StudioCatalogStatusContext.Provider>
    </StudioCatalogContext.Provider>
  );
}
