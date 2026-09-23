import SiteLink from '@/components/link/SiteLink';

interface ServerErrorProps {
  /**
   * Re-render the segment that failed. The error boundaries pass it; the
   * static `/500` page has nothing to retry and leaves it out.
   */
  onRetry?: () => void;
}

/**
 * What a visitor sees when a page fails to render: the `/500` page, the
 * root error boundary, and the global one that replaces the root layout.
 */
export default function ServerError({ onRetry }: ServerErrorProps) {
  return (
    <main
      id="main"
      className="mx-auto min-h-[80vh] max-w-breakpoint-lg space-y-lg px-lg py-16"
    >
      <h1 className="font-display text-display-large">Something went wrong.</h1>
      <p className="text-headline-small text-on-surface">
        The site hit a server error.
      </p>
      <div className="flex flex-wrap items-center gap-xl">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-label-large font-semibold text-on-primary transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
        )}
        <SiteLink href="/" className="text-primary text-title-large">
          Return Home
        </SiteLink>
      </div>
    </main>
  );
}
