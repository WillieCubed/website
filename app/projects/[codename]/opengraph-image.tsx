import { publicImageDataUri, renderEntityImage } from '@/lib/og/render';
import { getProject } from '@/lib/projects';
import { projectSeed } from '@/lib/projects/brand';

export const alt = 'Project';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image(props: {
  params: Promise<{ codename: string }>;
}) {
  const { codename } = await props.params;
  const project = await getProject(codename);
  if (!project) return renderEntityImage({ title: 'Project' });
  const cover =
    project.visibility === 'public'
      ? project.media.find((media) => media.kind === 'image')
      : undefined;
  return renderEntityImage({
    title: project.title,
    description: project.line,
    brand: projectSeed(project),
    cover:
      cover?.kind === 'image' ? await publicImageDataUri(cover.src) : undefined,
  });
}
