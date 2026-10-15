import type { Metadata } from 'next';

import { site } from '@/lib/site/identity';
import { absoluteUrl } from '@/lib/site/urls';

export interface PageMetadataInput {
  /** The bare page title, without the site name. */
  title: string;
  description: string;
  /** Site-relative path used for the canonical and og:url. */
  path: string;
  /** Site-relative or absolute image URL for social cards (1200×630). */
  image?: string;
  /**
   * Alt text for the social image. Defaults to the title, or to the site
   * tagline when the page uses the site card.
   */
  imageAlt?: string;
  type?: 'website' | 'article' | 'profile';
  noIndex?: boolean;
  /** Article fields. Only used when `type` is 'article'. */
  publishedTime?: Date | string;
  modifiedTime?: Date | string;
  tags?: string[];
  section?: string;
  /** Label and value pairs Slack shows under the link preview (first two). */
  labels?: Array<[label: string, value: string]>;
}

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

interface SocialPreview {
  siteName: string;
  locale: string;
  title: string;
  description: string | undefined;
  url: string;
  images: Array<{
    url: string;
    width: number;
    height: number;
    alt: string;
  }>;
}

/** Slack shows up to two label and value pairs under a link preview. */
function slackLabels(labels: Array<[string, string]>): Record<string, string> {
  return Object.fromEntries(
    labels.slice(0, 2).flatMap(([label, value], index) => [
      [`twitter:label${index + 1}`, label],
      [`twitter:data${index + 1}`, value],
    ])
  );
}

/**
 * Social titles for a page with no URL of its own to share, such as an error
 * page. Without them Next.js copies the suffixed document title into
 * og:title, and the preview would name Willie twice.
 */
export function bareSocialMetadata(
  title: string
): Pick<Metadata, 'openGraph' | 'twitter'> {
  return {
    openGraph: {
      siteName: site.name,
      locale: site.locale,
      type: 'website',
      title,
      images: [
        {
          url: site.ogImage,
          width: 1200,
          height: 630,
          alt: site.shortDescription,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      images: [{ url: site.ogImage, alt: site.shortDescription }],
    },
  };
}

function articleMetadata(
  shared: SocialPreview,
  {
    publishedTime,
    modifiedTime,
    tags,
    section,
  }: Pick<
    PageMetadataInput,
    'publishedTime' | 'modifiedTime' | 'tags' | 'section'
  >
): Metadata['openGraph'] {
  return {
    ...shared,
    type: 'article',
    authors: [absoluteUrl('/')],
    ...(publishedTime ? { publishedTime: toIso(publishedTime) } : {}),
    ...(modifiedTime ? { modifiedTime: toIso(modifiedTime) } : {}),
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(section ? { section } : {}),
  };
}

function socialDescription(title: string, description: string) {
  return description && description !== title ? description : undefined;
}

/**
 * Build page metadata that keeps the site name out of the OpenGraph title.
 *
 * Next.js copies the templated document title into og:title unless the page
 * sets openGraph.title itself, so this helper always sets it to the bare
 * title. The document title still gets the "· Willie Chalmers III" suffix from
 * the root template for platforms that never show og:site_name.
 */
export function pageMetadata({
  title,
  description,
  path,
  image,
  imageAlt,
  type = 'website',
  noIndex = false,
  publishedTime,
  modifiedTime,
  tags,
  section,
  labels,
}: PageMetadataInput): Metadata {
  // Next.js replaces a parent's openGraph and twitter objects wholesale
  // when a page sets its own, so the site-level fields are repeated here.
  // Next.js 16 does not inject a nested segment's opengraph-image file
  // into a page that sets openGraph itself, so entity pages pass their
  // image route explicitly and everything else falls back to the site card.
  const url = image ?? site.ogImage;
  const alt = imageAlt ?? (image ? title : site.shortDescription);
  // A note without a description falls back to its own text, which is also
  // its title. A link preview would print the same sentence twice, so the
  // social tags leave it out; search results still get the page's own text.
  const summary = socialDescription(title, description);
  const shared = {
    siteName: site.name,
    locale: site.locale,
    title,
    description: summary,
    url: path,
    images: [{ url, width: 1200, height: 630, alt }],
  };
  const openGraph: Metadata['openGraph'] =
    type === 'article'
      ? articleMetadata(shared, { publishedTime, modifiedTime, tags, section })
      : { ...shared, type };
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title,
      description: summary,
      images: [{ url, alt }],
    },
    ...(labels && labels.length > 0 ? { other: slackLabels(labels) } : {}),
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  };
}
