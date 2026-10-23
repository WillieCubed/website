import { type ReactNode, useRef, useState } from 'react';

import type { DraftContent } from '@/lib/studio/types';

import StudioWritingLayout from './StudioWritingLayout';
import WritingHeading from './WritingHeading';
import WritingMetadata from './WritingMetadata';
import type { DraftUpdate } from './writing-contracts';

interface WritingDraftLayoutProps {
  body: DraftContent;
  savedRevisionId: string;
  liveRevisionId: string | null;
  update: (change: DraftUpdate) => void;
  dirty: boolean;
  status: string;
  hidden: boolean;
  published: string;
  minutes: number;
  controls: ReactNode;
  children: ReactNode;
}

/** Heading visibility and title focus stay with the editable document's metadata. */
export default function WritingDraftLayout({
  body,
  savedRevisionId,
  liveRevisionId,
  update,
  dirty,
  status,
  hidden,
  published,
  minutes,
  controls,
  children,
}: WritingDraftLayoutProps) {
  const [showHeading, setShowHeading] = useState(
    Boolean(body.title || body.description)
  );
  const titleField = useRef<HTMLTextAreaElement>(null);
  return (
    <StudioWritingLayout
      hidden={hidden}
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
          body={body}
          update={update}
        />
      }
      metadata={
        <WritingMetadata
          savedRevisionId={savedRevisionId}
          liveRevisionId={liveRevisionId}
          showHeading={showHeading}
          setShowHeading={setShowHeading}
          titleField={titleField}
          body={body}
          dirty={dirty}
          status={status}
          update={update}
          published={published}
          minutes={minutes}
        />
      }
      controls={controls}
    >
      {children}
    </StudioWritingLayout>
  );
}
