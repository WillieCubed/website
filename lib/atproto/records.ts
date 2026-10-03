import type { ComAtprotoRepoStrongRef } from '@atcute/atproto';
import type { Blob } from '@atcute/lexicons';
import type {
  SiteStandardDocument,
  SiteStandardPublication,
} from '@atcute/standard-site';

import { site } from '@/lib/site';
import { stripMdxSyntax } from '@/lib/text/strip-mdx';
import { themeSchemes } from '@/lib/theme';

import { publishingIdentity } from './config';

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
  /** `featuredImage`, when the writing sets one. */
  image?: string;
}

export interface DocumentExtras {
  coverImage?: Blob;
  /** The Bluesky post announcing the document (Phase 3). */
  bskyPostRef?: ComAtprotoRepoStrongRef.Main;
}

export function documentPath(slug: string): string {
  return `/writings/${slug}`;
}

const graphemes = new Intl.Segmenter('en', { granularity: 'grapheme' });

/** Cuts text to a lexicon's grapheme limit, ending on an ellipsis if it cut. */
function clip(text: string, max: number): string {
  const parts = [...graphemes.segment(text)];
  if (parts.length <= max) return text;
  return `${parts
    .slice(0, max - 1)
    .map(({ segment }) => segment)
    .join('')}…`;
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
    preferences: { showInDiscover: true },
  };
}

/**
 * A writing as a standard.site document. `content` is left out on
 * purpose: the site renders its own HTML and readers link to it, while
 * `textContent` gives them the whole text for search and reading time.
 */
export function documentRecord(
  source: DocumentSource,
  extras: DocumentExtras = {}
): SiteStandardDocument.Main {
  const tags = source.tags
    .map((tag) => clip(tag.replace(/^#+/, '').trim(), 128))
    .filter(Boolean);
  const edited = source.lastUpdated.getTime() > source.published.getTime();
  return {
    $type: 'site.standard.document',
    site: publishingIdentity().publicationUri,
    path: documentPath(source.slug),
    title: clip(source.title, 500),
    ...(source.description &&
      source.description !== source.title && {
        description: clip(source.description, 3000),
      }),
    publishedAt: source.published.toISOString(),
    ...(edited && { updatedAt: source.lastUpdated.toISOString() }),
    ...(tags.length > 0 && { tags }),
    textContent: stripMdxSyntax(source.body),
    ...(extras.coverImage && { coverImage: extras.coverImage }),
    ...(extras.bskyPostRef && { bskyPostRef: extras.bskyPostRef }),
  };
}
