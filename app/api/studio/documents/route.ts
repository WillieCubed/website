import { createHash } from 'node:crypto';

import { RESERVED_WRITING_SLUGS, isWritingSlug } from '@/lib/indieweb/utils';
import { studioRoute } from '@/lib/studio/auth';
import { importMdx, parseDraftContent } from '@/lib/studio/document';
import { StudioError } from '@/lib/studio/errors';
import { getStudioStore } from '@/lib/studio/store';
import { readWritingFile } from '@/lib/writings/load';

export async function GET(request: Request) {
  return studioRoute(request, async () =>
    Response.json({ documents: await getStudioStore().list() })
  );
}

export async function POST(request: Request) {
  return studioRoute(request, async () => {
    const input = await request.json();
    const slug = input.sourceSlug ?? input.slug;
    if (
      typeof slug !== 'string' ||
      !isWritingSlug(slug) ||
      RESERVED_WRITING_SLUGS.has(slug)
    )
      throw new StudioError(
        400,
        'Choose a lowercase writing address using words and hyphens.'
      );
    const store = getStudioStore();
    let body;
    if (input.sourceSlug) {
      const current = await store.bySlug(slug);
      if (current) return Response.json(current);
      let file: Buffer;
      try {
        file = readWritingFile(slug).source;
      } catch {
        throw new StudioError(404, 'Writing source not found.');
      }
      const sha = createHash('sha1')
        .update(`blob ${file.byteLength}\0`)
        .update(file)
        .digest('hex');
      body = importMdx(file.toString(), sha);
    } else body = parseDraftContent(input.body);
    return Response.json(await store.create(slug, body), { status: 201 });
  });
}
