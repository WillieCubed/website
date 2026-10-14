/**
 * Return the deployed Git commit SHA, or null when the host does not provide
 * one. Disable caching so deployment checks read the current revision.
 */
export function GET() {
  return Response.json(
    { sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null },
    {
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
