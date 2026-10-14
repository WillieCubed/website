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
  const description =
    entry.summary ??
    (plainTextExcerpt(
      entry.contentFormat === 'html' ? htmlText(entry.content) : entry.content
    ) ||
      (entry.postType === 'photo'
        ? `A photo from ${site.author.givenName}.`
        : `A short note from ${site.author.givenName}.`));
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
    `postType: ${JSON.stringify(toWritingPostType(entry))}`,
  ];

  if (entry.audio?.length) lines.push(`audio: ${JSON.stringify(entry.audio)}`);
  if (entry.video?.length) lines.push(`video: ${JSON.stringify(entry.video)}`);
  if (entry.event) lines.push(`event: ${JSON.stringify(entry.event)}`);
  const people = (entry.properties?.category ?? []).flatMap((value) => {
    if (typeof value !== 'object') return [];
    if (!Array.isArray(value.type) || !value.type.includes('h-card')) return [];
    const props = value.properties as Record<string, unknown[]> | undefined;
    const name = props?.name?.[0],
      url = props?.url?.[0];
    return typeof name === 'string' && typeof url === 'string'
      ? [{ name: name.trim(), url: photoUrl(url) }]
      : [];
  });
  if (people.length) lines.push(`people: ${JSON.stringify(people)}`);

  if (entry.inReplyTo)
    lines.push(`inReplyTo: ${JSON.stringify(entry.inReplyTo)}`);
  if (entry.likeOf) lines.push(`likeOf: ${JSON.stringify(entry.likeOf)}`);
  if (entry.repostOf) lines.push(`repostOf: ${JSON.stringify(entry.repostOf)}`);
  if (entry.bookmarkOf) {
    lines.push(`bookmarkOf: ${JSON.stringify(entry.bookmarkOf)}`);
  }
  if (entry.photos.length > 0) {
    lines.push('photo:');
    entry.photos.forEach(({ url, alt }) => {
      lines.push(`  - url: ${JSON.stringify(url)}`);
      lines.push(`    alt: ${JSON.stringify(alt)}`);
    });
  }
  if (entry.rsvp && entry.inReplyTo) {
    lines.push('rsvp:');
    lines.push(`  eventUrl: ${JSON.stringify(entry.inReplyTo)}`);
    lines.push(`  status: ${JSON.stringify(entry.rsvp)}`);
  }
  const syndication = syndicationLinks(entry);
  if (syndication.length > 0) {
    lines.push('syndication:');
    syndication.forEach(({ name, url }) => {
      lines.push(`  - name: ${JSON.stringify(name)}`);
      lines.push(`    url: ${JSON.stringify(url)}`);
    });
  }
  if (entry.syndicateTo.length > 0) {
    lines.push(
      `syndicateTo: ${JSON.stringify(entry.syndicateTo.map(({ uid }) => uid))}`
    );
  }

  return `${lines.join('\n')}\n---\n\n${entry.content.trim()}\n`;
}
// Only an already published copy may appear as a syndication link. A target
// from mp-syndicate-to is only intent until someone posts the copy.
function syndicationLinks(
  entry: MicropubCreateRequest
): { name: string; url: string }[] {
  const links = entry.syndication.map((url) => ({
    name: syndicationName(url),
    url,
  }));
  return links.filter(
    (link, index) => links.findIndex(({ url }) => url === link.url) === index
  );
}
// The writings loader treats "reply" as a note with inReplyTo set, so the
// stored postType collapses to note; the frontmatter keeps inReplyTo.
function toWritingPostType(entry: MicropubCreateRequest): string {
  return entry.postType === 'reply' ? 'note' : entry.postType;
}
function titleForEntry(entry: MicropubCreateRequest, published: Date): string {
  if (entry.postType === 'reply') return `Reply from ${formatDate(published)}`;
  if (entry.postType === 'like') return `Like from ${formatDate(published)}`;
  if (entry.postType === 'repost')
    return `Repost from ${formatDate(published)}`;
  if (entry.postType === 'bookmark') {
    return `Bookmark from ${formatDate(published)}`;
  }
  if (entry.postType === 'rsvp') return `RSVP from ${formatDate(published)}`;
  if (entry.postType === 'photo') {
    return `Photo from ${formatDate(published)}`;
  }
  if (['audio', 'video', 'event'].includes(entry.postType))
    return `${entry.postType[0].toUpperCase()}${entry.postType.slice(1)} from ${formatDate(published)}`;
  return `Note from ${formatDate(published)}`;
}
function formatDate(date: Date): string {
  return isoDateOnly(date);
}
function propertiesForEntry(
  entry: MicropubCreateRequest
): Record<string, (string | Record<string, unknown>)[]> {
  return Object.fromEntries(
    Object.entries({
      content: entry.content ? [entry.content] : [],
      name: entry.name ? [entry.name] : [],
      summary: entry.summary ? [entry.summary] : [],
      category: entry.categories,
      'in-reply-to': entry.inReplyTo ? [entry.inReplyTo] : [],
      'like-of': entry.likeOf ? [entry.likeOf] : [],
      'repost-of': entry.repostOf ? [entry.repostOf] : [],
      'bookmark-of': entry.bookmarkOf ? [entry.bookmarkOf] : [],
      rsvp: entry.rsvp ? [entry.rsvp] : [],
      photo: entry.photos.map(({ url, alt }) => ({ value: url, alt })),
      syndication: entry.syndication,
      audio: entry.audio ?? [],
      video: entry.video ?? [],
    }).filter(([, values]) => values.length)
  );
}
