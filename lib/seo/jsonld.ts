import { absoluteUrl, site } from '@/lib/site';

export type JsonLdNode = Record<string, unknown>;

/**
 * Stable ids, so a node on one page can point at an entity on another.
 * Consumers only resolve an `@id` inside the same document, so a page whose
 * nodes reference the person includes `personLd()` in its own graph.
 */
export const ids = {
  website: absoluteUrl('/#website'),
  person: absoluteUrl('/#person'),
} as const;

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

/** A calendar day in the local zone, which is how the site stores its dates. */
function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function graph(...nodes: JsonLdNode[]): JsonLdNode {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

export function websiteLd(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': ids.website,
    url: absoluteUrl('/'),
    name: site.name,
    alternateName: site.shortName,
    description: site.description,
    inLanguage: site.language,
    publisher: { '@id': ids.person },
  };
}

export function personLd(): JsonLdNode {
  return {
    '@type': 'Person',
    '@id': ids.person,
    name: site.author.name,
    givenName: site.author.givenName,
    familyName: site.author.familyName,
    url: absoluteUrl('/'),
    image: absoluteUrl(site.author.photo),
    description: site.shortDescription,
    sameAs: site.social.map((profile) => profile.href),
    worksFor: site.ventures.map((venture) => ({
      '@type': 'Organization',
      '@id': absoluteUrl(`/#org-${venture.key}`),
      name: venture.name,
      url: venture.url,
    })),
  };
}

export function profilePageLd(): JsonLdNode {
  return {
    '@type': 'ProfilePage',
    '@id': absoluteUrl('/#profile'),
    url: absoluteUrl('/'),
    name: site.name,
    inLanguage: site.language,
    mainEntity: { '@id': ids.person },
    isPartOf: { '@id': ids.website },
  };
}

export function homeGraph(): JsonLdNode {
  return graph(websiteLd(), personLd(), profilePageLd());
}

export interface BlogPostingInput {
  path: string;
  title: string;
  description: string;
  published: Date | string;
  updated?: Date | string;
  tags: string[];
  /** Site-relative or absolute image URL. */
  image: string;
  seriesName?: string;
}

export function blogPostingLd(input: BlogPostingInput): JsonLdNode {
  const url = absoluteUrl(input.path);
  return {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    headline: input.title,
    description: input.description,
    datePublished: toIso(input.published),
    ...(input.updated ? { dateModified: toIso(input.updated) } : {}),
    author: { '@id': ids.person },
    publisher: { '@id': ids.person },
    image: absoluteUrl(input.image),
    inLanguage: site.language,
    ...(input.tags.length > 0 ? { keywords: input.tags.join(', ') } : {}),
    ...(input.seriesName
      ? {
          isPartOf: { '@type': 'CreativeWorkSeries', name: input.seriesName },
        }
      : {}),
  };
}

export interface EventInput {
  path: string;
  name: string;
  description?: string;
  starts: Date;
  ends: Date;
  places: Array<{ name: string; region?: string; lat: number; lng: number }>;
  /** Site-relative or absolute image URL. */
  image?: string;
}

/**
 * An in-person event, or null when it has no place: Google requires a
 * location, and markup that fails that requirement is worse than none.
 */
export function eventLd(input: EventInput): JsonLdNode | null {
  if (!input.name || input.places.length === 0) return null;
  const url = absoluteUrl(input.path);
  return {
    '@type': 'Event',
    '@id': `${url}#event`,
    url,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    startDate: isoDay(input.starts),
    endDate: isoDay(input.ends),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: input.places.map((place) => ({
      '@type': 'Place',
      name: place.name,
      address: place.region ? `${place.name}, ${place.region}` : place.name,
      geo: {
        '@type': 'GeoCoordinates',
        latitude: place.lat,
        longitude: place.lng,
      },
    })),
    organizer: { '@id': ids.person },
    ...(input.image ? { image: [absoluteUrl(input.image)] } : {}),
  };
}

export function breadcrumbLd(
  crumbs: Array<{ name: string; path: string }>
): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * Serializes for a `<script type="application/ld+json">` body. `<` is
 * escaped so a title containing `</script>` cannot end the tag early.
 */
export function serializeJsonLd(data: JsonLdNode): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
