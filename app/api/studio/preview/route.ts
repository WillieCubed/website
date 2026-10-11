import { studioRoute } from '@/lib/studio/auth';
import { parseDraftContent, portablePreview } from '@/lib/studio/document';
import { websitePreviewBody } from '@/lib/studio/preview';
import { preparePublicationPreview } from '@/lib/studio/publication';

export async function POST(request: Request) {
  return studioRoute(request, async () => {
    const { body, slug } = await request.json();
    const content = await preparePublicationPreview(parseDraftContent(body));
    const address = typeof slug === 'string' ? slug : 'draft';
    const portable = await portablePreview(content, address);
    const contentHtml = await websitePreviewBody(content, address);
    return Response.json({
      ...portable,
      html:
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        contentHtml,
      contentHtml,
    });
  });
}
