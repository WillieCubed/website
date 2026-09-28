import { absoluteUrl, canonicalUrl, site } from '@/lib/site';
import type { WritingData } from '@/lib/writings/types';

// A page's address here always comes from `canonicalUrl`, so the structured
// data names a page exactly as its canonical link does. Ids and image URLs
// are not page addresses and use `absoluteUrl`.

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

export function graph(...nodes: JsonLdNode[]): JsonLdNode {
  return { '@context': 'https://schema.org', '@graph': nodes };
}

export function websiteLd(): JsonLdNode {
  return {
    '@type': 'WebSite',
    '@id': ids.website,
    url: canonicalUrl('/'),
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
    url: canonicalUrl('/'),
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
    url: canonicalUrl('/'),
    name: site.name,
    inLanguage: site.language,
    mainEntity: { '@id': ids.person },
    isPartOf: { '@id': ids.website },
  };
}

export function homeGraph(): JsonLdNode {
  return graph(websiteLd(), personLd(), profilePageLd());
}

export type PostingType = 'BlogPosting' | 'SocialMediaPosting';

/**
 * An article is a BlogPosting. Everything else a writing can be is a post
 * in a stream: a note, a photo, and any post that answers, likes, reposts,
 * bookmarks, or RSVPs to another page, whatever its postType says.
 */
export function postingType(
  writing: Pick<
    WritingData,
    'postType' | 'inReplyTo' | 'likeOf' | 'repostOf' | 'bookmarkOf' | 'rsvp'
  >
): PostingType {
  const answers =
    writing.inReplyTo ||
    writing.likeOf ||
    writing.repostOf ||
    writing.bookmarkOf ||
    writing.rsvp;
  return writing.postType === 'article' && !answers
    ? 'BlogPosting'
    : 'SocialMediaPosting';
}

export interface PostingInput {
  type: PostingType;
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

export function postingLd(input: PostingInput): JsonLdNode {
  const url = canonicalUrl(input.path);
  return {
    '@type': input.type,
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

export interface WebPageInput {
  path: string;
  name: string;
  description: string;
  /** CollectionPage for an index that lists other pages. */
  type?: 'WebPage' | 'CollectionPage';
  /** Site-relative or absolute URL of the page's social image. */
  image?: string;
  /** The pages an index lists, in order. An empty list is left out. */
  items?: Array<{ name: string; path: string }>;
}

/**
 * A page that is not an article: an index or an initiative. It points at the
 * website and the person, so its graph includes `websiteLd()` and
 * `personLd()` as well.
 */
export function webPageLd(input: WebPageInput): JsonLdNode {
  const url = canonicalUrl(input.path);
  return {
    '@type': input.type ?? 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name: input.name,
    description: input.description,
    inLanguage: site.language,
    isPartOf: { '@id': ids.website },
    author: { '@id': ids.person },
    ...(input.image
      ? {
          primaryImageOfPage: {
            '@type': 'ImageObject',
            url: absoluteUrl(input.image),
          },
        }
      : {}),
    ...(input.items && input.items.length > 0
      ? {
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: input.items.map((item, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: item.name,
              url: canonicalUrl(item.path),
            })),
          },
        }
      : {}),
  };
}

export interface EventInput {
  path: string;
  name: string;
  description: string;
  /** Calendar days as `yyyy-mm-dd`; an initiative part has no times. */
  startDate: string;
  endDate: string;
  /** In travel order. An event with none leaves `location` out. */
  places: Array<{ name: string; region?: string; lat: number; lng: number }>;
  /** Site-relative or absolute URL of the event's image. */
  image?: string;
}

/**
 * An initiative part as an in-person event that Willie runs and appears in.
 * It points at the person, so its graph includes `personLd()` as well.
 */
export function eventLd(input: EventInput): JsonLdNode {
  const url = canonicalUrl(input.path);
  return {
    '@type': 'Event',
    '@id': `${url}#event`,
    url,
    name: input.name,
    description: input.description,
    startDate: input.startDate,
    endDate: input.endDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    ...(input.places.length > 0
      ? {
          location: input.places.map((place) => ({
            '@type': 'Place',
            name: place.region ? `${place.name}, ${place.region}` : place.name,
            address: {
              '@type': 'PostalAddress',
              addressLocality: place.name,
              ...(place.region ? { addressRegion: place.region } : {}),
            },
            geo: {
              '@type': 'GeoCoordinates',
              latitude: place.lat,
              longitude: place.lng,
            },
          })),
        }
      : {}),
    organizer: { '@id': ids.person },
    performer: { '@id': ids.person },
    ...(input.image ? { image: absoluteUrl(input.image) } : {}),
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
      item: canonicalUrl(crumb.path),
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
