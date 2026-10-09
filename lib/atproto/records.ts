import type { ComAtprotoRepoStrongRef } from '@atcute/atproto';
import type { Blob } from '@atcute/lexicons';
import type {
  SiteStandardDocument,
  SiteStandardPublication,
} from '@atcute/standard-site';

import { site } from '@/lib/site';
import { clipText } from '@/lib/text/clip';
import { themeSchemes } from '@/lib/theme';
import { writingText } from '@/lib/writings/content';
import type { WritingData } from '@/lib/writings/types';

import { publishingIdentity } from './config';
import { type DocumentMetadata, publicationSettings } from './metadata';

/** A published writing, already loaded, in the shape a document needs. */
export interface DocumentSource {
  slug: string;
  title: string;
  description: string;
  published: Date;
  lastUpdated: Date;
  tags: string[];
  /** The MDX body. */
  body: string;
  contentFormat?: WritingData['contentFormat'];
  photos?: WritingData['photos'];
  micropub?: WritingData['micropub'];
  audio?: WritingData['audio'];
  video?: WritingData['video'];
  /** `featuredImage`, when the writing sets one. */
  image?: string;
  atproto?: DocumentMetadata;
  syndicateTo?: string[];
  syndication?: { name: string; url: string }[];
  hasExplicitTitle?: boolean;
}

export interface DocumentExtras {
  coverImage?: Blob;
  /** The Bluesky post announcing the document (Phase 3). */
  bskyPostRef?: ComAtprotoRepoStrongRef.Main;
}

export function documentPath(slug: string): string {
  return `/writings/${slug}`;
}

/** `#2f6f5e` as the lexicon's RGB color. */
function rgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    $type: 'site.standard.theme.color#rgb' as const,
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

/**
 * The site as a standard.site publication. `url` is the origin with no
 * trailing slash; a document's canonical URL is `url` + `path`.
 */
export function publicationRecord(icon?: Blob): SiteStandardPublication.Main {
  const colors = themeSchemes.light;
  const settings = publicationSettings();
  return {
    $type: 'site.standard.publication',
    name: site.name,
    url: site.origin as SiteStandardPublication.Main['url'],
    description: site.description,
    ...(icon && { icon }),
    basicTheme: {
      $type: 'site.standard.theme.basic',
      background: rgb(colors.surface),
      foreground: rgb(colors.onSurface),
      accent: rgb(colors.primary),
      accentForeground: rgb(colors.onPrimary),
    },
    ...(settings.labels && { labels: settings.labels }),
    ...(settings.preferences && { preferences: settings.preferences }),
  };
}

/**
 * Extension content remains optional. Plain text gives every reader the
 * complete writing even when it cannot render the supplied union member.
 */
export function documentRecord(
  source: DocumentSource,
  extras: DocumentExtras = {}
): SiteStandardDocument.Main {
  const tags = source.tags
    .map((tag) => clipText(tag.replace(/^#+/, '').trim(), 128, 1280))
    .filter(Boolean);
  const edited = source.lastUpdated.getTime() > source.published.getTime();
  return {
    $type: 'site.standard.document',
    ...Object.fromEntries(
      Object.entries(source.atproto ?? {}).filter(([, value]) => value !== null)
    ),
    site: publishingIdentity().publicationUri,
    path: documentPath(source.slug),
    title: clipText(source.title, 500, 5000),
    ...(source.description &&
      source.description !== source.title && {
        description: clipText(source.description, 3000, 30000),
      }),
    publishedAt: source.published.toISOString(),
    ...(edited && { updatedAt: source.lastUpdated.toISOString() }),
    ...(tags.length > 0 && { tags }),
    textContent: writingText(source.body, source),
    ...(extras.coverImage && { coverImage: extras.coverImage }),
    ...(extras.bskyPostRef && { bskyPostRef: extras.bskyPostRef }),
  };
}
