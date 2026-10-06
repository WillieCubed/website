import SiteLink from '@/components/link/SiteLink';
import MediaMention from '@/components/media/MediaMention';
import TopBar from '@/components/site/TopBar';

import { type MediaMention as Mention, getMediaMentions } from '@/lib/media';
import { pageMetadata, site, sitePage } from '@/lib/site';

import './media.css';

const mediaPage = sitePage('/media');

export const metadata = pageMetadata({
  title: mediaPage.label,
  description: mediaPage.description,
  path: mediaPage.path,
});

export default function MediaPage() {
  const mentionsByYear = new Map<string, Mention[]>();
  for (const mention of getMediaMentions()) {
    const year = mention.published.slice(0, 4);
    const mentions = mentionsByYear.get(year) ?? [];
    mentions.push(mention);
    mentionsByYear.set(year, mentions);
  }

  return (
    <>
      <div className="media-top-bar">
        <TopBar
          column="content"
          crumbs={[{ label: mediaPage.label, href: mediaPage.path }]}
        />
      </div>
      <main id="main" className="media-page">
        <div className="media-page__heading">
          <h1 className="text-display-small">{mediaPage.label}</h1>
          <p className="text-body-large text-muted">
            A few places you might have seen me.
          </p>
        </div>
        {[...mentionsByYear].map(([year, mentions]) => (
          <section
            key={year}
            className="media-page__year"
            aria-labelledby={`media-year-${year}`}
          >
            <h2
              id={`media-year-${year}`}
              className="text-title-medium text-muted"
            >
              {year}
            </h2>
            <div className="media-page__mentions">
              {mentions
                .sort((a, b) => Number(b.featured) - Number(a.featured))
                .map((mention) => (
                  <MediaMention key={mention.id} mention={mention} />
                ))}
            </div>
          </section>
        ))}
        <p className="media-page__contact text-body-medium text-muted">
          Media inquiries:{' '}
          <SiteLink
            href={`mailto:${site.emails.hello}`}
            className="link-animated"
          >
            {site.emails.hello}
          </SiteLink>
        </p>
      </main>
    </>
  );
}
