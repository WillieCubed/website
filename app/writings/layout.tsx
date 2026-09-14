import React from 'react';

interface WritingsLayoutProps {
  children: React.ReactNode;
  modal: React.ReactNode;
}

/**
 * Layout for the writings section.
 * Includes a modal slot for intercepting routes (e.g., collection modals).
 */
export default function WritingsLayout({
  children,
  modal,
}: WritingsLayoutProps) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
