import { uploadAsset } from '@/lib/studio/assets';
import { studioRoute } from '@/lib/studio/auth';
import { StudioError } from '@/lib/studio/errors';

export async function POST(request: Request) {
  return studioRoute(request, async () => {
    const file = (await request.formData()).get('file');
    if (!(file instanceof File))
      throw new StudioError(400, 'Choose an image to upload.');
    return Response.json(await uploadAsset(file), { status: 201 });
  });
}
