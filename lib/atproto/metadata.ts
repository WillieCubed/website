import { ComAtprotoLabelDefs } from '@atcute/atproto';
import { AppBskyFeedPost } from '@atcute/bluesky';
import { safeParse } from '@atcute/lexicons';
import {
  SiteStandardDocument,
  SiteStandardPublication,
  SiteStandardThemeBasic,
  SiteStandardThemeColor,
} from '@atcute/standard-site';

import { assertOwnerCopy } from './owner-copy';

const knownMembers = {
  'app.bsky.feed.post': AppBskyFeedPost.mainSchema,
  'site.standard.document': SiteStandardDocument.mainSchema,
  'site.standard.publication': SiteStandardPublication.mainSchema,
  'site.standard.theme.basic': SiteStandardThemeBasic.mainSchema,
  'site.standard.theme.color#rgb': SiteStandardThemeColor.rgbSchema,
  'site.standard.theme.color#rgba': SiteStandardThemeColor.rgbaSchema,
  'com.atproto.label.defs#selfLabels': ComAtprotoLabelDefs.selfLabelsSchema,
};

type Document = SiteStandardDocument.Main;
export type DocumentMetadata = {
  [K in 'contributors' | 'labels' | 'content' | 'links' | 'bskyPostRef']?:
    | Document[K]
    | null;
};
export type PublicationSettings = {
  labels?: SiteStandardPublication.Main['labels'] | null;
  preferences?: SiteStandardPublication.Main['preferences'];
};
export const DOCUMENT_EXTENSION_FIELDS = [
  'contributors',
  'labels',
  'content',
  'links',
  'bskyPostRef',
] as const;
const TYPE =
  /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*){2,}(?:#[A-Za-z][A-Za-z0-9]*)?$/i;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('AT Protocol metadata must be an object.');
  return value as Record<string, unknown>;
}

function validateTypedMember(member: unknown, field: string): void {
  const typed = object(member);
  if (typeof typed.$type !== 'string' || !TYPE.test(typed.$type))
    throw new Error(`atproto.${field} needs a valid lexicon $type.`);
  const schema = knownMembers[typed.$type as keyof typeof knownMembers];
  if (schema == null) return;
  const result = safeParse(schema, member, { strict: true });
  if (!result.ok)
    throw new Error(`Invalid ${typed.$type} metadata: ${result.message}`);
}

export function parseDocumentMetadata(
  value: unknown
): DocumentMetadata | undefined {
  if (value === undefined) return undefined;
  const input = object(value);
  const output: Record<string, unknown> = {};
  for (const field of DOCUMENT_EXTENSION_FIELDS) {
    if (!Object.hasOwn(input, field)) continue;
    const member = input[field];
    if (member === null) {
      output[field] = null;
      continue;
    }
    if (field === 'content' || field === 'links')
      validateTypedMember(member, field);
    if (field === 'bskyPostRef') assertOwnerCopy(member);
    output[field] = member;
  }
  const checked = safeParse(
    SiteStandardDocument.mainSchema,
    {
      $type: 'site.standard.document',
      site: 'https://example.com',
      title: 'Metadata validation',
      publishedAt: '2026-10-07T00:00:00Z',
      ...Object.fromEntries(
        Object.entries(output).filter(([, entry]) => entry !== null)
      ),
    },
    { strict: true }
  );
  if (!checked.ok)
    throw new Error(`Invalid AT Protocol metadata: ${checked.message}`);
  return output as DocumentMetadata;
}

export function publicationSettings(): PublicationSettings {
  const raw = process.env.ATPROTO_PUBLICATION_SETTINGS;
  if (!raw) return {};
  const input = object(JSON.parse(raw));
  const checked = safeParse(
    SiteStandardPublication.mainSchema,
    {
      $type: 'site.standard.publication',
      url: 'https://example.com',
      name: 'Settings validation',
      ...(input.labels != null && { labels: input.labels }),
      ...(input.preferences !== undefined && {
        preferences: input.preferences,
      }),
    },
    { strict: true }
  );
  if (!checked.ok)
    throw new Error(`Invalid publication settings: ${checked.message}`);
  return {
    ...(Object.hasOwn(input, 'labels') && {
      labels: input.labels as PublicationSettings['labels'],
    }),
    ...(input.preferences !== undefined && {
      preferences: checked.value.preferences,
    }),
  };
}
