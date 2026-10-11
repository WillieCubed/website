import matter from 'gray-matter';
import { createHash } from 'node:crypto';

import { isPrivatePreview } from '@/lib/studio/config';
import { readWritingFile } from '@/lib/writings';

/** Public proof identifies the deployed published MDX without exposing its source. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  if (isPrivatePreview()) return new Response('Not found', { status: 404 });
  const { slug } = await context.params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    return new Response('Not found', { status: 404 });
  try {
    const { source } = readWritingFile(slug);
    const { data } = matter(source.toString());
    if (data.draft || data.hidden || typeof data.studioRevision !== 'string')
      return new Response('Not found', { status: 404 });
    return Response.json(
      {
        revisionId: data.studioRevision,
        sourceSha: createHash('sha1')
          .update(`blob ${source.byteLength}\0`)
          .update(source)
          .digest('hex'),
        commit: process.env.NEXT_PUBLIC_SITE_REVISION ?? null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
