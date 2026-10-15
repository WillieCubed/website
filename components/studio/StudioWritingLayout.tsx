import type { ComponentPropsWithRef, ReactNode } from 'react';

/** The document's geometry belongs here, regardless of data readiness. */
export default function StudioWritingLayout({
  heading,
  metadata,
  controls,
  children,
  compact = false,
  pending = false,
  hidden = false,
}: {
  heading: ReactNode;
  metadata: ReactNode;
  controls: ReactNode;
  children: ReactNode;
  compact?: boolean;
  pending?: boolean;
  hidden?: boolean;
}) {
  return (
    <>
      <header
        hidden={hidden}
        className="studio-writing-header pb-4"
        data-compact={compact || undefined}
        aria-hidden={pending || undefined}
      >
        {heading}
        <div className="studio-document-metadata">{metadata}</div>
      </header>
      <div className="studio-writing-workspace" hidden={hidden}>
        <div
          className="studio-document-toolbar"
          aria-hidden={pending || undefined}
        >
          {controls}
        </div>
        {children}
      </div>
    </>
  );
}

export function StudioHeadingFields({ children }: { children: ReactNode }) {
  return <div className="studio-heading-fields">{children}</div>;
}

export function StudioWritingSurface({
  className = '',
  ...props
}: ComponentPropsWithRef<'div'>) {
  return (
    <div
      role="region"
      aria-label="Writing editor"
      {...props}
      className={`studio-writing-surface ${className}`.trim()}
    />
  );
}
