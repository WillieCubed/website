import Icon from '@/components/icons/Icon';
import FeedAuthor from '@/components/indieweb/FeedAuthor';
import CollectionLayout from '@/components/site/CollectionLayout';
import TagChips from '@/components/writings/TagChips';
import WritingItem from '@/components/writings/WritingItem';

import { socialSettings } from '@/lib/atproto/config';
import { getWritingContentHtml } from '@/lib/indieweb/feeds/items';
import { absoluteUrl } from '@/lib/site/urls';
import {
  type WritingData,
  getAllTags,
  getAllWritings,
  getSeries,
} from '@/lib/writings/index';

import StandardSocialControls from './StandardSocialControls';

interface WritingsIndexProps {
  /** The feed's name, shown as the page's heading. */
  name: string;
  /** Site-relative address of the page, the feed's u-url. */
  path: string;
  writings: WritingData[];
  /** The tag the page lists, if it lists one; its chip shows as selected. */
  currentTag?: string;
}

/**
 * The body of /writings and of each tag page: one h-feed with its name,
 * address, and author, the entries, then the tag chips.
 */
export default async function WritingsIndex({
  name,
  path,
  writings,
  currentTag,
}: WritingsIndexProps) {
  // With nothing published there is nothing to filter.
  const published = await getAllWritings();

  return (
    <CollectionLayout className="h-feed">
      {/* WebSub discovery: the root layout names the hub, and this names
          the topic a reader subscribes to. React hoists it into <head>. */}
      <link rel="self" href={absoluteUrl(path)} />
      {/* h-feed: u-url so parsers know which page this feed is, and
          p-author so they know whose it is */}
      <a href={absoluteUrl(path)} className="u-url hidden" />
      <FeedAuthor />
      <header className="collection-header">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-4">
          <h1 className="p-name text-display-small">{name}</h1>
          {path === '/writings' && socialSettings() && (
            <StandardSocialControls action="subscription" />
          )}
        </div>
      </header>
      {/* No Suspense around the entries: a boundary streams its content
          after the shell, outside this h-feed, and parsers that read the
          HTML without running scripts then find a feed with no entries. */}
      <section className="pb-6 pt-lg">
        <WritingsList writings={writings} />
      </section>
      {published.length > 0 && (
        <section className="flex flex-col gap-4 medium:flex-row medium:flex-wrap medium:items-center medium:justify-between">
          <TagFilter currentTag={currentTag} />
        </section>
      )}
    </CollectionLayout>
  );
}

interface WritingsListProps {
  writings: WritingData[];
}

async function WritingsList({ writings }: WritingsListProps) {
  // Resolve every series a listed writing belongs to. A series can be a file
  // or an initiative; the series loader handles both.
  const seriesSlugs = [
    ...new Set(writings.flatMap((w) => (w.series ? [w.series.slug] : []))),
  ];
  const seriesMap = new Map(
    await Promise.all(
      seriesSlugs.map(async (slug) => {
        const series = await getSeries(slug).catch(() => null);
        return [slug, series] as const;
      })
    )
  );
  const contentMap = new Map(
    await Promise.all(
      writings
        .filter((writing) => !writing.hasExplicitTitle)
        .map(
          async (writing) =>
            [writing.slug, await getWritingContentHtml(writing.slug)] as const
        )
    )
  );

  if (writings.length === 0) {
    return <p className="text-body-large text-muted">Nothing published yet.</p>;
  }

  return (
    <div className="collection-items space-y-3">
      {writings.map((writing) => (
        <WritingItem
          key={writing.slug}
          writing={writing}
          seriesName={
            writing.series
              ? seriesMap.get(writing.series.slug)?.name
              : undefined
          }
          seriesHref={
            writing.series
              ? seriesMap.get(writing.series.slug)?.href
              : undefined
          }
          contentHtml={contentMap.get(writing.slug)}
        />
      ))}
    </div>
  );
}

interface TagFilterProps {
  currentTag?: string;
}

async function TagFilter({ currentTag }: TagFilterProps) {
  const tags = await getAllTags();

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="no-scrollbar -mx-5 flex items-center gap-2 overflow-x-auto px-5 medium:mx-0 medium:overflow-visible medium:px-0">
      <Icon name="tag" size={14} className="shrink-0 text-muted" />
      <TagChips
        tags={tags}
        filter
        currentTag={currentTag}
        className="flex items-center gap-2 medium:flex-wrap"
      />
    </div>
  );
}
