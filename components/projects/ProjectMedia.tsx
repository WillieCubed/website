import SiteLink from '@/components/link/SiteLink';
import YouTubeEmbed from '@/components/mdx/YouTubeEmbed';

import type { ProjectMedia as Media } from '@/lib/projects';

/** One piece of a project's media. The first item on a page is the hero. */
export default function ProjectMedia({
  media,
  hero = false,
}: {
  media: Media;
  hero?: boolean;
}) {
  const className = hero ? 'project-hero' : 'project-figure';
  switch (media.kind) {
    case 'image':
      return (
        <figure className={className}>
          {/* Project captures come in any size, so they are laid out by CSS
              rather than given fixed next/image dimensions. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={media.src}
            alt={media.alt}
            aria-hidden={media.decorative ? true : undefined}
          />
          {media.caption && <figcaption>{media.caption}</figcaption>}
        </figure>
      );
    case 'video':
      return (
        <div className={className}>
          <YouTubeEmbed videoId={media.youtubeId} title={media.title} />
        </div>
      );
    case 'document':
      return (
        <SiteLink className="project-document" href={media.href}>
          {media.title}
        </SiteLink>
      );
  }
}
