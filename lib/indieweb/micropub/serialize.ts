import { mapList } from '@/lib/indieweb/micropub/frontmatter';
import type { MicropubCreateRequest } from '@/lib/indieweb/micropub/types';
import { assertPhotoAlts, photoUrl } from '@/lib/indieweb/micropub/validation';
import { syndicationName } from '@/lib/indieweb/syndication';
import { isoDateOnly, plainTextExcerpt } from '@/lib/indieweb/utils';
import { site } from '@/lib/site/identity';
import { htmlText } from '@/lib/writings/content';

export function buildMicropubWritingFile(
  entry: MicropubCreateRequest,
  _slug: string
): string {
  assertPhotoAlts(entry.photos);
  const published = entry.published ?? new Date();
  const title = entry.name ?? titleForEntry(entry, published);
  const description = descriptionForEntry(entry);
  const lines = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `published: ${published.toISOString()}`,
    `lastUpdated: ${published.toISOString()}`,
    `tags: ${JSON.stringify(entry.categories)}`,
    `draft: ${entry.postStatus === 'draft'}`,
    `contentFormat: ${JSON.stringify(entry.contentFormat ?? 'text')}`,
    `micropub: ${JSON.stringify({ type: [entry.h === 'event' ? 'h-event' : 'h-entry'], properties: entry.properties ?? propertiesForEntry(entry) })}`,
    `postType: ${JSON.stringify(entry.postType === 'reply' ? 'note' : entry.postType)}`,
  ];

  appendEntryMetadata(lines, entry);

  return `${lines.join('\n')}\n---\n\n${entry.content.trim()}\n`;
}
// Only an already published copy may appear as a syndication link. A target
// from mp-syndicate-to is only intent until someone posts the copy.
function syndicationLinks(
  entry: MicropubCreateRequest
): { name: string; url: string }[] {
  return [...new Set(entry.syndication)].map((url) => ({
    name: syndicationName(url),
    url,
  }));
}
function titleForEntry(entry: MicropubCreateRequest, published: Date): string {
  const named = [
    'reply',
    'like',
    'repost',
    'bookmark',
    'rsvp',
    'photo',
    'audio',
    'video',
    'event',
  ].includes(entry.postType);
  const label = !named
    ? 'Note'
    : entry.postType === 'rsvp'
      ? 'RSVP'
      : entry.postType[0].toUpperCase() + entry.postType.slice(1);
  return `${label} from ${isoDateOnly(published)}`;
}
function propertiesForEntry(
  entry: MicropubCreateRequest
): Record<string, (string | Record<string, unknown>)[]> {
  return Object.fromEntries(
    Object.entries({
      content: optionalValue(entry.content),
      name: optionalValue(entry.name),
      summary: optionalValue(entry.summary),
      category: entry.categories,
      'in-reply-to': optionalValue(entry.inReplyTo),
      'like-of': optionalValue(entry.likeOf),
      'repost-of': optionalValue(entry.repostOf),
      'bookmark-of': optionalValue(entry.bookmarkOf),
      rsvp: optionalValue(entry.rsvp),
      photo: entry.photos.map(({ url, alt }) => ({ value: url, alt })),
      syndication: entry.syndication,
      audio: entry.audio ?? [],
      video: entry.video ?? [],
    }).filter(([, values]) => values.length > 0)
  );
}

function descriptionForEntry(entry: MicropubCreateRequest): string {
  return (
    entry.summary ??
    (plainTextExcerpt(
      entry.contentFormat === 'html' ? htmlText(entry.content) : entry.content
    ) ||
      (entry.postType === 'photo'
        ? `A photo from ${site.author.givenName}.`
        : `A short note from ${site.author.givenName}.`))
  );
}
function peopleForEntry(entry: MicropubCreateRequest) {
  return (entry.properties?.category ?? []).flatMap((value) => {
    if (typeof value !== 'object') return [];
    if (!Array.isArray(value.type) || !value.type.includes('h-card')) return [];
    const props = value.properties as Record<string, unknown[]> | undefined;
    const name = props?.name?.[0],
      url = props?.url?.[0];
    return typeof name === 'string' && typeof url === 'string'
      ? [{ name: name.trim(), url: photoUrl(url) }]
      : [];
  });
}
function appendEntryMetadata(lines: string[], entry: MicropubCreateRequest) {
  const metadata = {
    audio: entry.audio,
    video: entry.video,
    event: entry.event,
    people: peopleForEntry(entry),
    inReplyTo: entry.inReplyTo,
    likeOf: entry.likeOf,
    repostOf: entry.repostOf,
    bookmarkOf: entry.bookmarkOf,
  };
  for (const [key, value] of Object.entries(metadata).filter(([, value]) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value)
  ))
    lines.push(`${key}: ${JSON.stringify(value)}`);
  lines.push(...(mapList('photo', entry.photos) ?? []));
  if (entry.rsvp && entry.inReplyTo)
    lines.push(
      'rsvp:',
      `  eventUrl: ${JSON.stringify(entry.inReplyTo)}`,
      `  status: ${JSON.stringify(entry.rsvp)}`
    );
  lines.push(...(mapList('syndication', syndicationLinks(entry)) ?? []));
  if (entry.syndicateTo.length > 0)
    lines.push(
      `syndicateTo: ${JSON.stringify(entry.syndicateTo.map(({ uid }) => uid))}`
    );
}

function optionalValue(value: string | undefined): string[] {
  return value ? [value] : [];
}
