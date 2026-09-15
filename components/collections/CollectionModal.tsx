'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';

interface CollectionModalProps {
  slug: string;
  children: React.ReactNode;
}

/**
 * Modal wrapper for displaying collections in an overlay.
 * Used by intercepting routes when navigating from within writings context.
 */
export default function CollectionModal({
  slug,
  children,
}: CollectionModalProps) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const onDismiss = useCallback(() => {
    router.back();
  }, [router]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  // Close on click outside
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) {
        onDismiss();
      }
    },
    [onDismiss]
  );

  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Focus trap - focus the modal on mount
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="collection-title"
    >
      {/* Modal container - starts from top with consistent spacing */}
      <div className="flex min-h-full justify-center px-4 pt-8 tablet:px-8">
        <div
          ref={modalRef}
          tabIndex={-1}
          className="relative mb-8 w-full max-w-breakpoint-md self-start rounded-xl bg-surface shadow-xl outline-none"
        >
          {/* Modal header - fixed height (h-14 = 56px) */}
          <div className="flex h-14 items-center justify-between rounded-t-xl border-b border-outline-variant bg-surface px-lg">
            <Link
              href={`/collections/${slug}`}
              className="link-animated text-label-medium text-on-surface-variant"
            >
              Open full page &rarr;
            </Link>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              type="button"
              className="-mr-2 rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label="Close modal"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>

          {/* Modal content - can extend beyond viewport bottom */}
          <div className="px-lg py-lg">{children}</div>
        </div>
      </div>
    </div>
  );
}
