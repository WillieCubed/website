import Icon from '@/components/icons/Icon';
import FeedAuthor from '@/components/indieweb/FeedAuthor';
import SiteLink from '@/components/link/SiteLink';
import WritingItem from '@/components/writings/WritingItem';

import { getWritingContentHtml } from '@/lib/feeds/items';
import { absoluteUrl } from '@/lib/site';
import {
  type WritingData,
  getAllTags,
  getAllWritings,
  getSeries,
} from '@/lib/writings';
import { tagPath } from '@/lib/writings/tags';

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
 * address, and author, the entries, then the tag chips and search.
 */
export default async function WritingsIndex({
  name,
  path,
  writings,
  currentTag,
}: WritingsIndexProps) {
  // With nothing published there is nothing to filter or search.
  const published = await getAllWritings();

  return (
    <main id="main" className="h-feed mx-auto max-w-[840px] px-5 pb-8">
      {/* WebSub discovery: the root layout names the hub, and this names
          the topic a reader subscribes to. React hoists it into <head>. */}
      <link rel="self" href={absoluteUrl(path)} />
      {/* h-feed: u-url so parsers know which page this feed is, and
          p-author so they know whose it is */}
      <a href={absoluteUrl(path)} className="u-url hidden" />
      <FeedAuthor />
      <section className="mt-6">
        <div className="space-y-xl">
          <h1 className="p-name text-display-small">{name}</h1>
        </div>
      </section>
      {/* No Suspense around the entries: a boundary streams its content
          after the shell, outside this h-feed, and parsers that read the
          HTML without running scripts then find a feed with no entries. */}
      <section className="pb-6 pt-lg">
        <WritingsList writings={writings} />
      </section>
      {published.length > 0 && (
        <section className="flex flex-col gap-4 medium:flex-row medium:flex-wrap medium:items-center medium:justify-between">
          <TagFilter currentTag={currentTag} />
          <form action="/search" className="flex items-center gap-2">
            <label htmlFor="writings-search" className="sr-only">
              Search
            </label>
            <input
              id="writings-search"
              name="q"
              type="search"
              placeholder="Search"
              className="min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-2 text-body-medium text-ink medium:w-44 medium:flex-none medium:py-1.5"
            />
            <button
              type="submit"
              aria-label="Search"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary medium:size-9"
            >
              <Icon name="search" size={16} />
            </button>
          </form>
        </section>
      )}
    </main>
  );
}

async function WritingsList({ writings }: { writings: WritingData[] }) {
  // Resolve every series a listed writing belongs to. A series can be a file
  // in content/series/ or an initiative, and getSeries handles both.
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
    <div className="space-y-3">
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

const CHIP =
  'shrink-0 rounded-full px-3 py-1.5 text-label-large transition-colors';
const CHIP_SELECTED = `${CHIP} bg-primary text-on-primary`;
const CHIP_IDLE = `${CHIP} border border-line bg-card text-ink hover:border-accent hover:text-accent`;

async function TagFilter({ currentTag }: { currentTag?: string }) {
  const tags = await getAllTags();

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="no-scrollbar -mx-5 flex items-center gap-2 overflow-x-auto px-5 medium:mx-0 medium:flex-wrap medium:overflow-visible medium:px-0">
      <Icon name="tag" size={14} className="shrink-0 text-muted" />
      <SiteLink
        href="/writings"
        aria-current={!currentTag ? 'page' : undefined}
        className={!currentTag ? CHIP_SELECTED : CHIP_IDLE}
      >
        All
      </SiteLink>
      {tags.map((tag) => (
        <SiteLink
          key={tag}
          href={tagPath(tag)}
          aria-current={currentTag === tag ? 'page' : undefined}
          className={currentTag === tag ? CHIP_SELECTED : CHIP_IDLE}
        >
          {tag}
        </SiteLink>
      ))}
    </div>
  );
}
