import type { PropsWithChildren } from 'react';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import TopBar, { COLUMN } from '@/components/site/TopBar';

import { STATIC_PAGES } from '@/lib/entities/pages';
import { getPublicResources } from '@/lib/indieweb/resources';
import { getInitiatives } from '@/lib/initiatives';
import { publishedSitemapContent } from '@/lib/seo/sitemap';
import { formatDate, pageMetadata, sitePage } from '@/lib/site';
import { getAllWritings } from '@/lib/writings';
import { tagPath, writingCount } from '@/lib/writings/tags';

import './sitemap.css';

const page = sitePage('/sitemap');
export const metadata = pageMetadata({
  title: page.label,
  description: page.description,
  path: page.path,
});

function SitemapLink({
  href,
  title,
  description,
  fullNavigation = false,
  children,
}: PropsWithChildren<{
  href: string;
  title: string;
  description: string;
  fullNavigation?: boolean;
}>) {
  const content = (
    <>
      <span className="sitemap-link__heading">
        <span className="sitemap-link__title text-title-small">{title}</span>
        <code className="sitemap-route text-body-small">{href}</code>
      </span>
      <span className="sitemap-description text-body-small text-muted">
        {description}
      </span>
      {children}
    </>
  );
  // Files and route-handler responses cannot use app-router navigation.
  return fullNavigation ? (
    <a href={href} className="sitemap-page-link">
      {content}
    </a>
  ) : (
    <SiteLink href={href} className="sitemap-page-link" preview={false}>
      {content}
    </SiteLink>
  );
}

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
            <section aria-labelledby="sitemap-browse">
              <h2 id="sitemap-browse" className="text-title-large">
                Browse
              </h2>
              <ul className="sitemap-links sitemap-grid">
                {STATIC_PAGES.filter(({ href }) => href !== page.path).map(
                  (item) => (
                    <li key={item.href}>
                      <SitemapLink
                        href={item.href}
                        title={item.href === '/' ? 'Home' : item.title}
                        description={item.description}
                      />
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
                      <SitemapLink
                        href={initiative.href}
                        title={initiative.title}
                        description={initiative.tagline}
                      />
                      {initiative.parts.length > 0 && (
                        <ul className="sitemap-parts">
                          {initiative.parts.map((part) => (
                            <li key={part.slug}>
                              <SitemapLink
                                href={`${initiative.href}/${part.slug}`}
                                title={`${initiative.partLabel} ${part.number}: ${part.title}`}
                                description={
                                  part.description ??
                                  part.tagline ??
                                  `${formatDate(part.starts, 'short')}–${formatDate(part.ends, 'short')}`
                                }
                              />
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
                      <SitemapLink
                        href={`/writings/${writing.slug}`}
                        title={writing.title}
                        description={writing.description}
                      >
                        <time
                          className="text-body-small text-muted"
                          dateTime={new Date(writing.published).toISOString()}
                        >
                          {formatDate(writing.published)}
                        </time>
                      </SitemapLink>
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
                      <SitemapLink
                        href={tagPath(tag)}
                        title={tag}
                        description={`${writingCount(writings.length)} on this topic.`}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
          {resourceGroups.map((group) => {
            const collections = new Map<string, typeof group.resources>();
            for (const resource of group.resources) {
              if (resource.directory)
                collections.set(resource.directory, [
                  ...(collections.get(resource.directory) ?? []),
                  resource,
                ]);
            }
            return (
              <section key={group.label} aria-label={group.directoryLabel}>
                <h2 className="text-title-large">{group.directoryLabel}</h2>
                <ul
                  className={`sitemap-resources sitemap-grid${collections.size === 2 || collections.size === 4 ? ' sitemap-grid--paired' : ''}`}
                >
                  {[...collections].map(([label, resources]) => {
                    const resource = resources[0];
                    const descriptionId = `sitemap-${group.label}-${encodeURIComponent(label)}`;
                    return (
                      <li key={label}>
                        {resources.length === 1 && !resource.usage ? (
                          <SitemapLink
                            href={resource.path}
                            title={label}
                            description={resource.description}
                            fullNavigation
                          >
                            <span className="text-body-small text-muted">
                              {resource.format}
                            </span>
                          </SitemapLink>
                        ) : (
                          <div className="sitemap-resource">
                            <div className="sitemap-link__heading">
                              <h3 className="text-title-small">{label}</h3>
                              {resource.usage && (
                                <code className="sitemap-route text-body-small">
                                  {resource.path}
                                </code>
                              )}
                            </div>
                            <p
                              id={descriptionId}
                              className="sitemap-description text-body-small text-muted"
                            >
                              {resource.description}
                            </p>
                            {resource.usage ? (
                              <>
                                <p className="sitemap-tool__usage text-body-small text-muted">
                                  {resource.usage}
                                </p>
                                {resource.documentation && (
                                  <SiteLink
                                    href={resource.documentation}
                                    className="sitemap-secondary-link text-body-small"
                                    aria-label={`${label} documentation`}
                                  >
                                    Documentation{' '}
                                    <Icon name="external" size={14} />
                                  </SiteLink>
                                )}
                              </>
                            ) : (
                              <ul className="sitemap-formats">
                                {resources.map((format) => (
                                  <li key={format.path}>
                                    {/* Feed responses require a full browser navigation. */}
                                    <a
                                      href={format.path}
                                      className="sitemap-format-link"
                                      aria-label={`${label} (${format.format})`}
                                      aria-describedby={descriptionId}
                                    >
                                      <span className="text-label-medium">
                                        {format.format}
                                      </span>
                                      <code className="sitemap-route text-body-small">
                                        {format.path}
                                      </code>
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </main>
    </>
  );
}
