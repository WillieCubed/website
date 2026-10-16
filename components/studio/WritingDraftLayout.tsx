import { type ReactNode, useRef, useState } from 'react';

import StudioWritingLayout from './StudioWritingLayout';
import WritingHeading from './WritingHeading';
import WritingMetadata from './WritingMetadata';
import type { WritingDocument } from './writing-contracts';

type WritingDraftMetadata = Pick<
  WritingDocument,
  'body' | 'draft' | 'update' | 'dirty' | 'status'
>;

interface WritingDraftLayoutProps {
  document: WritingDraftMetadata;
  hidden: boolean;
  published: string;
  minutes: number;
  controls: ReactNode;
  children: ReactNode;
}

/** Heading visibility and title focus stay with the editable document's metadata. */
export default function WritingDraftLayout({
  document,
  hidden,
  published,
  minutes,
  controls,
  children,
}: WritingDraftLayoutProps) {
  const { body } = document;
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
          update={document.update}
        />
      }
      metadata={
        <WritingMetadata
          draft={document.draft}
          showHeading={showHeading}
          setShowHeading={setShowHeading}
          titleField={titleField}
          body={body}
          dirty={document.dirty}
          status={document.status}
          update={document.update}
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
