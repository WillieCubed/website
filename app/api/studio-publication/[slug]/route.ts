import matter from 'gray-matter';
import { createHash } from 'node:crypto';

import { readWritingFile } from '@/lib/writings/load';

/**
 * Return a published writing's Studio revision, Git blob hash, and deployed
 * commit so Studio can confirm publication without reading the source.
 * Return 404 for previews, invalid or missing slugs, drafts, hidden
 * writings, or writings without a Studio revision.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  if (process.env.SITE_MODE === 'preview')
    return new Response('Not found', { status: 404 });
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
        commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
