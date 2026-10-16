'use client';

import ServerError from '@/components/error/ServerError';

/**
 * Catches a page that throws while rendering. The root layout stays in
 * place, so the footer and search still work around the message.
 */
interface ErrorBoundaryProps {
  retry: () => void;
}

export default function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return <ServerError onRetry={retry} />;
}
