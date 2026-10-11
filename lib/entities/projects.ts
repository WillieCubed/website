import type { Project } from '@/lib/projects';
import { projectSeed } from '@/lib/projects/brand';
import { projectFacts } from '@/lib/projects/facts';

import type { EntityCard } from './types';

/** Draft and hidden projects never enter the public hover-card payload. */
export function projectCards(projects: Project[]): EntityCard[] {
  return projects
    .filter((project) => !project.draft && project.visibility !== 'hidden')
    .map((project) => {
      const image =
        project.visibility === 'public'
          ? project.media.find((media) => media.kind === 'image')
          : undefined;
      return {
        href: project.href,
        kind: 'project',
        title: project.title,
        description: project.line ?? '',
        cover: image ? { src: image.src, alt: image.alt } : undefined,
        brand: projectSeed(project),
        meta: projectFacts(project).join(' · '),
      };
    });
}
