import { brandSeeds } from '@/lib/brand/scheme';
import { detailHref } from '@/lib/entities/ventures';
import { products, ventures } from '@/lib/home/ventures';

import { projectSeed } from './brand';
import { projectFacts } from './facts';
import type { Project } from './schema';

export interface ProjectCard {
  id: string;
  href: string;
  title: string;
  description?: string;
  context?: string;
  brand?: string;
  image?: { src: string; alt: string; portrait?: boolean; fromLeft?: boolean };
}

/** Published homepage copy and media remain the source of every work card. */
export function currentWorkCards(): ProjectCard[] {
  return ventures
    .filter((venture) => !venture.hidden)
    .sort((a, b) => b.weight - a.weight)
    .flatMap((venture) => {
      const media = venture.detail.media;
      const image = media.kind === 'image' ? media : undefined;
      const card: ProjectCard = {
        id: venture.id,
        href: detailHref(venture.id),
        title: venture.name,
        description: venture.detail.body[0],
        context: venture.parent,
        brand: brandSeeds[venture.brand]?.hex,
        image: image
          ? {
              src: image.src,
              alt: image.alt,
              fromLeft: image.fromLeft,
              portrait: image.height > image.width,
            }
          : undefined,
      };
      const children = Object.values(products)
        .filter((product) => product.parent === venture.name)
        .map(
          (product): ProjectCard => ({
            id: product.id,
            href: detailHref(product.id),
            title: product.name,
            description: product.copy,
            context: `${product.parent} · ${product.platform}`,
            brand: brandSeeds[product.brand]?.hex,
            image: {
              src: product.image.src,
              alt: product.detail.media.alt,
              portrait: product.image.height > product.image.width,
            },
          })
        );
      return [card, ...children];
    });
}

export function projectToCard(project: Project): ProjectCard {
  const image =
    project.visibility === 'public'
      ? project.media.find((media) => media.kind === 'image')
      : undefined;
  return {
    id: project.slug,
    href: project.href,
    title: project.title,
    description: project.line,
    context: projectFacts(project).join(' · '),
    brand: projectSeed(project),
    image: image ? { src: image.src, alt: image.alt } : undefined,
  };
}
