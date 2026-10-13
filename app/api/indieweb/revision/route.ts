export function GET() {
  return Response.json(
    { sha: process.env.NEXT_PUBLIC_SITE_REVISION ?? null },
    {
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
