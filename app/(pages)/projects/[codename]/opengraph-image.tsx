import { publicImageDataUri, renderEntityImage } from '@/lib/og/render';
import { getProject } from '@/lib/projects';

export const alt = 'Project';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image(props: {
  params: Promise<{ codename: string }>;
}) {
  const { codename } = await props.params;
  const { project } = await getProject(codename);
  return renderEntityImage({
    kind: 'Project',
    title: project.title,
    description: project.tagline,
    meta: project.clientAttribution || undefined,
    cover: await publicImageDataUri(project.thumbnail),
  });
}
