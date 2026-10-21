import type { ReactNode } from 'react';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import Button from '@/components/site/Button';
import TopBar from '@/components/site/TopBar';

import StudioInspectorHost from './StudioInspectorHost';
import StudioWritingLayout, {
  StudioHeadingFields,
  StudioWritingSurface,
} from './StudioWritingLayout';

/** Loading and editing share the same navigation, column, and canvas. */
interface StudioDocumentFrameProps {
  children: ReactNode;
}

export default function StudioDocumentFrame({
  children,
}: StudioDocumentFrameProps) {
  return (
    <>
      <TopBar
        column="reading"
        crumbs={[{ label: 'Your writings', href: '/studio' }]}
      />
      <main id="main" className="studio-editor writing-image-page">
        <StudioInspectorHost>
          <div className="studio-reading-column site-frame site-frame--reading">
            {children}
          </div>
        </StudioInspectorHost>
      </main>
    </>
  );
}

interface StudioDocumentPendingContentProps {
  error?: string;
}

export function StudioDocumentPendingContent({
  error,
}: StudioDocumentPendingContentProps) {
  return (
    <StudioWritingLayout
      pending
      heading={
        <StudioHeadingFields>
          <div className="studio-opening-line studio-opening-title text-headline-medium desktop:text-headline-large" />
          <div className="studio-opening-line studio-opening-description text-body-large" />
        </StudioHeadingFields>
      }
      metadata={
        <>
          <div className="studio-byline flex flex-wrap items-center gap-x-2 gap-y-2 text-label-large text-muted">
            <span className="studio-opening-date">
              <span className="studio-opening-line" />
            </span>
            <span>·</span>
            <span className="studio-opening-line studio-opening-reading-time" />
            <span>·</span>
            <span className="studio-opening-line studio-opening-state" />
            <span className="studio-editor-context text-label-large text-muted">
              <span>·</span>
              <span className="studio-opening-line studio-opening-save" />
            </span>
          </div>
          <div className="studio-tags studio-opening-tags">
            <span className="studio-opening-line" />
          </div>
        </>
      }
      controls={
        <nav className="studio-document-controls" aria-label="Writing controls">
          <Button disabled tabIndex={-1} className="studio-control-placeholder">
            <Icon name="sliders" size={18} />
            <span>Details</span>
          </Button>
          <Button disabled tabIndex={-1} className="studio-control-placeholder">
            <Icon name="eye" size={18} />
            <span>Preview</span>
          </Button>
          <Button disabled tabIndex={-1} className="studio-control-placeholder">
            <Icon name="more-horizontal" size={20} />
            <span className="sr-only">More options</span>
          </Button>
        </nav>
      }
    >
      <StudioWritingSurface>
        {!error && (
          <div
            className="studio-opening-prose text-body-medium leading-relaxed"
            aria-hidden="true"
          >
            {[4, 3, 4].map((lines, paragraph) => (
              <div className="studio-opening-paragraph" key={paragraph}>
                {Array.from({ length: lines }, (_, line) => (
                  <span className="studio-opening-line" key={line} />
                ))}
              </div>
            ))}
          </div>
        )}
        <p
          role={error ? 'alert' : 'status'}
          className={error ? 'text-body-large text-muted' : 'sr-only'}
        >
          {error || 'Loading…'}
        </p>
        {error && <SiteLink href="/studio">Your writings</SiteLink>}
      </StudioWritingSurface>
    </StudioWritingLayout>
  );
}
