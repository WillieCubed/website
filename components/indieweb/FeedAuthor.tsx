import { site } from '@/lib/site';

/**
 * The author of an h-feed, for parsers. Entries inside the feed inherit it,
 * so a reader that meets the index before any post knows whose it is. It is
 * a link to the homepage, where the representative h-card lives, rather than
 * a second copy of that card; the page already sits under the author's name,
 * so it is not shown.
 */
export default function FeedAuthor() {
  return (
    <a
      className="p-author h-card hidden"
      // eslint-disable-next-line site/no-raw-internal-anchor -- a hidden microformat anchor for parsers, which want the absolute canonical URL
      href={`${site.origin}/`}
    >
      {site.author.name}
    </a>
  );
}
