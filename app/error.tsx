'use client';

import ServerError from '@/components/error/ServerError';

/**
 * Catches a page that throws while rendering. The root layout stays in
 * place, so the footer and search still work around the message.
 */
export default function ErrorBoundary({ retry }: { retry: () => void }) {
  return <ServerError onRetry={retry} />;
}
