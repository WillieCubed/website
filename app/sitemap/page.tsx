import type { PropsWithChildren, ReactNode } from 'react';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import TopBar, { COLUMN } from '@/components/site/TopBar';

import { STATIC_PAGES } from '@/lib/entities/pages';
import {
  type PublicResource,
  type ResourceGroup,
  getPublicResources,
} from '@/lib/indieweb/resources';
import { formatRange } from '@/lib/initiatives/dates';
import { getInitiatives } from '@/lib/initiatives/index';
import { getPublishedProjects } from '@/lib/projects';
import { projectFacts } from '@/lib/projects/facts';
import { pageMetadata } from '@/lib/seo/metadata';
import { publishedSitemapContent } from '@/lib/seo/sitemap';
import { formatDate } from '@/lib/site/dates';
import { sitePage } from '@/lib/site/navigation';
import { getAllWritings } from '@/lib/writings/index';
import { tagPath, writingCount } from '@/lib/writings/tags';

import '../../components/seo/sitemap.css';

const page = sitePage('/sitemap');
export const metadata = pageMetadata({
  title: page.label,
  description: page.description,
  path: page.path,
});

interface SitemapLinkProps extends PropsWithChildren {
  href: string;
  title: string;
  description: string;
  fullNavigation?: boolean;
}

function SitemapLink({
  href,
  title,
  description,
  fullNavigation = false,
  children,
}: SitemapLinkProps) {
  const content = (
    <>
      <span className="sitemap-link__heading">
        <span className="sitemap-link__title text-title-medium">{title}</span>
        <code className="sitemap-route text-body-small">{href}</code>
      </span>
      <span className="sitemap-description text-body-medium text-muted">
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
  const [writings, initiatives, projects] = await Promise.all([
    getAllWritings(false),
    getInitiatives(),
    getPublishedProjects(),
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
            <Directory
              id="browse"
              title="Browse"
              items={STATIC_PAGES.filter(({ href }) => href !== page.path).map(
                (item) => ({
                  ...item,
                  title: item.href === '/' ? 'Home' : item.title,
                })
              )}
            />
            <Directory
              id="initiatives"
              title="Initiatives"
              items={published.initiatives.map((initiative) => ({
                href: initiative.href,
                title: initiative.title,
                description: initiative.tagline,
                after: initiative.parts.length > 0 && (
                  <ul className="sitemap-parts">
                    {initiative.parts.map((part) => (
                      <li key={part.slug}>
                        <SitemapLink
                          href={`${initiative.href}/${part.slug}`}
                          title={`${initiative.partLabel} ${part.number}: ${part.title}`}
                          description={
                            part.description ??
                            part.tagline ??
                            formatRange(part.starts, part.ends)
                          }
                        />
                      </li>
                    ))}
                  </ul>
                ),
              }))}
            />
            <Directory
              id="projects"
              title="Projects"
              items={projects.map((project) => ({
                href: project.href,
                title: project.title,
                description: project.line ?? projectFacts(project).join(' · '),
              }))}
            />
            <Directory
              id="writings"
              title="Writings"
              items={published.writings.map((writing) => ({
                href: `/writings/${writing.slug}`,
                title: writing.title,
                description: writing.description,
                children: (
                  <time
                    className="text-body-small text-muted"
                    dateTime={new Date(writing.published).toISOString()}
                  >
                    {formatDate(writing.published)}
                  </time>
                ),
              }))}
            />
            <Directory
              id="topics"
              title="Topics"
              items={published.topics.map(({ tag, writings }) => ({
                href: tagPath(tag),
                title: tag,
                description: `${writingCount(writings.length)} on this topic.`,
              }))}
            />
          </div>
          {resourceGroups.map((group) => (
            <ResourceDirectory key={group.label} group={group} />
          ))}
        </div>
      </main>
    </>
  );
}

interface DirectoryItem extends SitemapLinkProps {
  after?: ReactNode;
}
interface DirectoryProps {
  id: string;
  title: string;
  items: DirectoryItem[];
}
function Directory({ id, title, items }: DirectoryProps) {
  if (items.length === 0) return null;
  const heading = `sitemap-${id}`;
  return (
    <section aria-labelledby={heading}>
      <h2 id={heading} className="text-title-large">
        {title}
      </h2>
      <ul className="sitemap-links sitemap-grid">
        {items.map(({ after, ...link }) => (
          <li key={link.href}>
            <SitemapLink {...link} />
            {after}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface ResourceCollectionProps {
  groupLabel: string;
  label: string;
  resources: PublicResource[];
}

function ResourceCollection({
  groupLabel,
  label,
  resources,
}: ResourceCollectionProps) {
  const resource = resources[0];
  const descriptionId = `sitemap-${groupLabel}-${encodeURIComponent(label)}`;
  return (
    <li>
      {resources.length === 1 && !resource.usage ? (
        <SitemapLink
          href={resource.path}
          title={label}
          description={resource.description}
          fullNavigation
        >
          <span className="text-body-small text-muted">{resource.format}</span>
        </SitemapLink>
      ) : (
        <div className="sitemap-resource">
          <div className="sitemap-link__heading">
            <h3 className="text-title-medium">{label}</h3>
            {resource.usage && (
              <code className="sitemap-route text-body-small">
                {resource.path}
              </code>
            )}
          </div>
          <p
            id={descriptionId}
            className="sitemap-description text-body-medium text-muted"
          >
            {resource.description}
          </p>
          {resource.usage ? (
            <>
              <p className="sitemap-tool__usage text-body-medium text-muted">
                {resource.usage}
              </p>
              {resource.documentation && (
                <SiteLink
                  href={resource.documentation}
                  className="sitemap-secondary-link text-body-small"
                  aria-label={`${label} documentation`}
                >
                  Documentation <Icon name="external" size={14} />
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
                    <span className="text-label-large">{format.format}</span>
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
}

interface ResourceDirectoryProps {
  group: ResourceGroup;
}

function ResourceDirectory({ group }: ResourceDirectoryProps) {
  const collections = new Map<string, PublicResource[]>();
  for (const resource of group.resources) {
    if (resource.directory)
      collections.set(resource.directory, [
        ...(collections.get(resource.directory) ?? []),
        resource,
      ]);
  }
  return (
    <section aria-label={group.directoryLabel}>
      <h2 className="text-title-large">{group.directoryLabel}</h2>
      <ul className="sitemap-resources sitemap-grid">
        {[...collections].map(([label, resources]) => (
          <ResourceCollection
            key={label}
            groupLabel={group.label}
            label={label}
            resources={resources}
          />
        ))}
      </ul>
    </section>
  );
}
