import type { PropsWithChildren } from 'react';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import TopBar, { COLUMN } from '@/components/site/TopBar';

import { STATIC_PAGES } from '@/lib/entities/pages';
import {
  type PublicResource,
  type ResourceGroup,
  getPublicResources,
} from '@/lib/indieweb/resources';
import { type Initiative, getInitiatives } from '@/lib/initiatives/index';
import { type Project, getPublishedProjects } from '@/lib/projects';
import { projectFacts } from '@/lib/projects/facts';
import { pageMetadata } from '@/lib/seo/metadata';
import { publishedSitemapContent } from '@/lib/seo/sitemap';
import { formatDate } from '@/lib/site/dates';
import { sitePage } from '@/lib/site/navigation';
import { type WritingData, getAllWritings } from '@/lib/writings/index';
import { type TagGroup, tagPath, writingCount } from '@/lib/writings/tags';

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
            <BrowseDirectory />
            <InitiativeDirectory initiatives={published.initiatives} />
            <ProjectDirectory projects={projects} />
            <WritingDirectory writings={published.writings} />
            <TopicDirectory topics={published.topics} />
          </div>
          {resourceGroups.map((group) => (
            <ResourceDirectory key={group.label} group={group} />
          ))}
        </div>
      </main>
    </>
  );
}

function BrowseDirectory() {
  return (
    <section aria-labelledby="sitemap-browse">
      <h2 id="sitemap-browse" className="text-title-large">
        Browse
      </h2>
      <ul className="sitemap-links sitemap-grid">
        {STATIC_PAGES.filter(({ href }) => href !== page.path).map((item) => (
          <li key={item.href}>
            <SitemapLink
              href={item.href}
              title={item.href === '/' ? 'Home' : item.title}
              description={item.description}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface InitiativeDirectoryProps {
  initiatives: Initiative[];
}

function InitiativeDirectory({ initiatives }: InitiativeDirectoryProps) {
  if (initiatives.length === 0) return null;
  return (
    <section aria-labelledby="sitemap-initiatives">
      <h2 id="sitemap-initiatives" className="text-title-large">
        Initiatives
      </h2>
      <ul className="sitemap-links sitemap-grid">
        {initiatives.map((initiative) => (
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
  );
}

interface ProjectDirectoryProps {
  projects: Project[];
}

function ProjectDirectory({ projects }: ProjectDirectoryProps) {
  if (projects.length === 0) return null;
  return (
    <section aria-labelledby="sitemap-projects">
      <h2 id="sitemap-projects" className="text-title-large">
        Projects
      </h2>
      <ul className="sitemap-links sitemap-grid">
        {projects.map((project) => (
          <li key={project.href}>
            <SitemapLink
              href={project.href}
              title={project.title}
              description={project.line ?? projectFacts(project).join(' · ')}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface WritingDirectoryProps {
  writings: WritingData[];
}

function WritingDirectory({ writings }: WritingDirectoryProps) {
  if (writings.length === 0) return null;
  return (
    <section aria-labelledby="sitemap-writings">
      <h2 id="sitemap-writings" className="text-title-large">
        Writings
      </h2>
      <ul className="sitemap-links sitemap-grid">
        {writings.map((writing) => (
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
  );
}

interface TopicDirectoryProps {
  topics: TagGroup[];
}

function TopicDirectory({ topics }: TopicDirectoryProps) {
  if (topics.length === 0) return null;
  return (
    <section aria-labelledby="sitemap-topics">
      <h2 id="sitemap-topics" className="text-title-large">
        Topics
      </h2>
      <ul className="sitemap-links sitemap-grid">
        {topics.map(({ tag, writings }) => (
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
