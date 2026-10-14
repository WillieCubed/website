import { getProject } from '@/lib/projects';
import { projectSeed } from '@/lib/projects/brand';
import { publicImageDataUri, renderEntityImage } from '@/lib/seo/og/render';

export const alt = 'Project';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Render a PNG social preview with the project title, summary, brand color,
 * and public cover. Return a generic project preview when the project is
 * unavailable.
 */
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
