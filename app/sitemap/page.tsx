import SiteLink from '@/components/link/SiteLink';
import TopBar, { COLUMN } from '@/components/site/TopBar';

import { STATIC_PAGES } from '@/lib/entities/pages';
import { getPublicResources } from '@/lib/indieweb/resources';
import { getInitiatives } from '@/lib/initiatives';
import { publishedSitemapContent } from '@/lib/seo/sitemap';
import { formatDate, pageMetadata, site, sitePage } from '@/lib/site';
import { getAllWritings } from '@/lib/writings';
import { tagPath, writingCount } from '@/lib/writings/tags';

import './sitemap.css';

const page = sitePage('/sitemap');
export const metadata = pageMetadata({
  title: page.label,
  description: page.description,
  path: page.path,
});

export default async function SitemapPage() {
  const [writings, initiatives] = await Promise.all([
    getAllWritings(false),
    getInitiatives(),
  ]);
  const published = publishedSitemapContent({ writings, initiatives });
  const resourceGroups = getPublicResources()
    .filter((group) => group.directoryLabel)
    .sort((a, b) => a.directoryLabel!.localeCompare(b.directoryLabel!));

  return (
    <>
      <TopBar
        column="content"
        crumbs={[{ label: page.label, href: page.path }]}
      />
      <main id="main" className={`sitemap-page mx-auto ${COLUMN.content}`}>
        <h1 className="text-display-small">Sitemap</h1>
        <div className="sitemap-sections">
          <div className="sitemap-directory">
            <section aria-labelledby="sitemap-pages">
              <h2 id="sitemap-pages" className="text-title-large">
                Pages
              </h2>
              <ul className="sitemap-links sitemap-grid">
                {STATIC_PAGES.filter(({ href }) => href !== page.path).map(
                  (item) => (
                    <li key={item.href}>
                      <SiteLink
                        href={item.href}
                        className="sitemap-page-link"
                        preview={false}
                      >
                        <span className="text-body-large">
                          {item.href === '/' ? 'Home' : item.title}
                        </span>
                        <span className="sitemap-description text-body-small text-muted">
                          {item.description}
                        </span>
                      </SiteLink>
                    </li>
                  )
                )}
              </ul>
            </section>
            {published.initiatives.length > 0 && (
              <section aria-labelledby="sitemap-initiatives">
                <h2 id="sitemap-initiatives" className="text-title-large">
                  Initiatives
                </h2>
                <ul className="sitemap-links sitemap-grid">
                  {published.initiatives.map((initiative) => (
                    <li key={initiative.href}>
                      <SiteLink
                        href={initiative.href}
                        className="sitemap-page-link"
                        preview={false}
                      >
                        <span className="text-body-large">
                          {initiative.title}
                        </span>
                        <span className="sitemap-description text-body-small text-muted">
                          {initiative.tagline}
                        </span>
                      </SiteLink>
                      {initiative.parts.length > 0 && (
                        <ul className="sitemap-parts">
                          {initiative.parts.map((part) => (
                            <li key={part.slug}>
                              <SiteLink
                                href={`${initiative.href}/${part.slug}`}
                                className="sitemap-page-link"
                                preview={false}
                              >
                                <span className="text-body-medium">
                                  {initiative.partLabel} {part.number}:{' '}
                                  {part.title}
                                </span>
                                <span className="sitemap-description text-body-small text-muted">
                                  {part.description ??
                                    part.tagline ??
                                    `${formatDate(part.starts, 'short')}–${formatDate(part.ends, 'short')}`}
                                </span>
                              </SiteLink>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {published.writings.length > 0 && (
              <section aria-labelledby="sitemap-writings">
                <h2 id="sitemap-writings" className="text-title-large">
                  Writings
                </h2>
                <ul className="sitemap-links sitemap-grid">
                  {published.writings.map((writing) => (
                    <li key={writing.slug}>
                      <SiteLink
                        href={`/writings/${writing.slug}`}
                        className="sitemap-page-link"
                        preview={false}
                      >
                        <span className="text-body-large">{writing.title}</span>
                        <span className="sitemap-description text-body-small text-muted">
                          {writing.description}
                        </span>
                        <time
                          className="text-body-small text-muted"
                          dateTime={new Date(writing.published).toISOString()}
                        >
                          {formatDate(writing.published)}
                        </time>
                      </SiteLink>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {published.topics.length > 0 && (
              <section aria-labelledby="sitemap-topics">
                <h2 id="sitemap-topics" className="text-title-large">
                  Topics
                </h2>
                <ul className="sitemap-links sitemap-grid">
                  {published.topics.map(({ tag, writings }) => (
                    <li key={tag}>
                      <SiteLink
                        href={tagPath(tag)}
                        className="sitemap-page-link"
                        preview={false}
                      >
                        <span className="text-body-large">{tag}</span>
                        <span className="text-body-small text-muted">
                          {writingCount(writings.length)} on this topic.
                        </span>
                      </SiteLink>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          {resourceGroups.map((group) => {
            const collections = new Map<string, typeof group.resources>();
            for (const resource of group.resources) {
              if (resource.directory) {
                collections.set(resource.directory, [
                  ...(collections.get(resource.directory) ?? []),
                  resource,
                ]);
              }
            }
            return (
              <section key={group.label} aria-label={group.directoryLabel}>
                <h2 className="text-title-large">{group.directoryLabel}</h2>
                <ul className="sitemap-resources sitemap-grid">
                  {[...collections].map(([label, resources]) => (
                    <li key={label}>
                      <h3 className="text-title-small">{label}</h3>
                      <p className="sitemap-description text-body-small text-muted">
                        {resources[0].description}
                      </p>
                      <div className="sitemap-formats">
                        {resources.map((resource) => (
                          // Feed and file links require a full browser navigation.
                          <a
                            key={resource.path}
                            href={resource.path}
                            className="link-animated text-body-medium"
                            aria-label={`${label} (${resource.format}): ${resource.description}`}
                          >
                            {resource.format}
                          </a>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          <section aria-labelledby="sitemap-standards">
            <h2 id="sitemap-standards" className="text-title-large">
              Standards
            </h2>
            <p className="sitemap-standards text-body-medium text-muted">
              This site supports RSS, Atom, JSON Feed, Webmention, microformats,
              IndieAuth, Micropub, oEmbed, WebFinger, and OpenSearch. It
              provides read-only access through MCP
              {site.author.atprotoDid
                ? ' and supports AT Protocol identity'
                : ''}
              .
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
