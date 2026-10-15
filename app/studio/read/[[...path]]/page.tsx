import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';

import SiteLink from '@/components/link/SiteLink';
import CollectionLayout from '@/components/site/CollectionLayout';
import TopBar from '@/components/site/TopBar';
import ImportWriting from '@/components/studio/ImportWriting';
import WritingContent from '@/components/writings/WritingContent';
import WritingHeader from '@/components/writings/WritingHeader';
import WritingItem from '@/components/writings/WritingItem';

import { pageMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/site/urls';
import { isPrivatePreview } from '@/lib/studio/config';
import { websitePreviewBody } from '@/lib/studio/preview';
import { preparePublicationPreview } from '@/lib/studio/publication';
import {
  type ReadingEntry,
  overlayReadings,
  readingWritingData,
  safeReadingHtml,
} from '@/lib/studio/reading';
import { getStudioStore } from '@/lib/studio/store';
import type { Draft } from '@/lib/studio/types';
import {
  type WritingData,
  type WritingDocument,
  getAllWritings,
  getSeries,
  getSeriesWithWritings,
} from '@/lib/writings';
import { loadWriting } from '@/lib/writings/load';
import { normalizeTag, tagFromParam, tagPath } from '@/lib/writings/tags';

export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Writings',
    description: 'Private writing preview.',
    path: '/writings',
  }),
  robots: { index: false, follow: false, noarchive: true },
};

type Props = PageProps<'/studio/read/[[...path]]'>;

async function Reading({ params }: Props) {
  await connection();
  if (!isPrivatePreview()) notFound();
  const segments = (await params).path ?? [];
  const writings = await getAllWritings(true);
  let storageMessage = '';
  const drafts = await Promise.resolve()
    .then(() => getStudioStore().list())
    .catch(() => {
      storageMessage =
        'Private writing storage is unavailable. These are the writings in this checkout.';
      return [];
    });
  const all = overlayReadings(writings, drafts);
  const crumbs = [
    {
      label: 'Writings',
      href: '/writings',
      menuItems: all
        .slice(0, 6)
        .map((item) => ({ label: item.title, href: `/writings/${item.slug}` })),
    },
  ];
  const status = storageMessage && (
    <p role="status" className="text-body-small text-muted">
      {storageMessage}
    </p>
  );
  if (segments.length === 1 && !['tags', 'series'].includes(segments[0]))
    return (
      <ReadingArticle
        slug={segments[0]}
        all={all}
        drafts={drafts}
        writings={writings}
        crumbs={crumbs}
        status={status}
      />
    );
  return (
    <ReadingIndex
      segments={segments}
      all={all}
      writings={writings}
      crumbs={crumbs}
      status={status}
    />
  );
}
interface ReadingMenuItem {
  label: string;
  href: string;
}
interface ReadingCrumb extends ReadingMenuItem {
  menuItems: ReadingMenuItem[];
}
interface ReadingCollection {
  title: string;
  items: ReadingEntry[];
}
interface ReadingContext {
  all: ReadingEntry[];
  writings: WritingData[];
  crumbs: ReadingCrumb[];
  status: React.ReactNode;
}
interface ReadingArticleProps extends ReadingContext {
  slug: string;
  drafts: Draft[];
}

async function ReadingArticle({
  slug,
  all,
  drafts,
  writings,
  crumbs,
  status,
}: ReadingArticleProps) {
  const entry = all.find((item) => item.slug === slug);
  if (!entry) notFound();
  const { html, publishedContent, renderingMessage } = await readingContent(
    entry,
    drafts
  );
  const writing = readingWritingData(
    entry,
    writings.find((item) => item.slug === entry.slug)
  );
  const seriesData = entry.series
    ? await getSeriesWithWritings(entry.series.slug).catch(() => null)
    : null;
  return (
    <>
      <TopBar column="reading" crumbs={crumbs} />
      <main id="main">
        <article className="mx-auto max-w-breakpoint-2xl">
          <WritingHeader
            writing={writing}
            content={publishedContent?.content}
            seriesData={seriesData}
            canonicalUrl={absoluteUrl(`/writings/${entry.slug}`)}
          />
          <div className="mx-auto max-w-breakpoint-md px-lg pb-lg desktop:px-0">
            <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-label-large text-muted">
              {entry.status && <span>{entry.status}</span>}
              <Edit entry={entry} />
            </div>
            {status}
            {renderingMessage ? (
              <p role="status" className="text-body-large text-muted">
                {renderingMessage}
              </p>
            ) : publishedContent ? (
              <div className="-mx-lg desktop:mx-0">
                <WritingContent
                  content={publishedContent.content}
                  headings={publishedContent.headings}
                  writing={writing}
                  seriesData={seriesData}
                />
              </div>
            ) : (
              <div className="e-content">
                <div
                  dir="auto"
                  className={`prose prose-theme max-w-none prose-headings:scroll-mt-20 [&_p]:my-4 [&_p]:leading-relaxed [&_p]:text-on-surface ${writing.postType === 'note' ? 'prose-xl [&_p]:text-body-large' : 'prose-lg [&_p]:text-body-medium'}`}
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              </div>
            )}
            {!publishedContent && <Tags tags={entry.tags} />}
          </div>
        </article>
      </main>
    </>
  );
}
async function readingContent(entry: ReadingEntry, drafts: Draft[]) {
  let html = '';
  let publishedContent: WritingDocument | null = null;
  let renderingMessage = '';
  try {
    const privateDraft = drafts.find((draft) => draft.id === entry.editorId);
    html = privateDraft
      ? await websitePreviewBody(
          await preparePublicationPreview(privateDraft.head.body),
          entry.slug
        )
      : '';
    if (!privateDraft) {
      const loaded = await loadWriting(entry.slug);
      if (!loaded.writing.draft) publishedContent = loaded;
      else
        html = await safeReadingHtml(
          entry.source ?? loaded.content,
          `/writings/${entry.slug}`
        );
    }
  } catch {
    renderingMessage =
      'This writing contains a block that needs a portable alternative. Open the editor to review its retained source.';
  }

  return { html, publishedContent, renderingMessage };
}
interface ReadingIndexProps extends ReadingContext {
  segments: string[];
}

async function ReadingIndex({
  segments,
  all,
  writings,
  crumbs,
  status,
}: ReadingIndexProps) {
  const { title, items } = readingCollection(segments, all);
  const tags = [
    ...new Set(all.flatMap((item) => item.tags.map(normalizeTag))),
  ].sort();
  return (
    <>
      <TopBar column="content" crumbs={crumbs} />
      <CollectionLayout>
        <header className="collection-header space-y-4 pb-lg">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-display-small">{title}</h1>
            <SiteLink
              href="/studio"
              preview={false}
              className="link-animated text-label-large text-accent"
            >
              New writing
            </SiteLink>
          </div>
          {status}
        </header>
        <div className="collection-items space-y-3 pb-6">
          {await Promise.all(
            items.map(async (entry) => {
              const writing = readingWritingData(
                entry,
                writings.find((item) => item.slug === entry.slug)
              );
              const series = entry.series
                ? await getSeries(entry.series.slug).catch(() => null)
                : null;
              return (
                <div key={entry.slug}>
                  <WritingItem
                    writing={writing}
                    seriesName={series?.name}
                    seriesHref={series?.href}
                  />
                  {entry.status === 'Unpublished changes' && (
                    <p className="mt-2 text-label-medium text-muted">
                      Unpublished changes
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
        {items.length === 0 && (
          <p className="text-body-large text-muted">
            Your first writing is waiting.
          </p>
        )}
        <Tags
          tags={tags}
          filter
          currentTag={
            segments[0] === 'tags' && segments[1]
              ? tagFromParam(segments[1])
              : undefined
          }
        />
      </CollectionLayout>
    </>
  );
}

function readingCollection(
  segments: string[],
  all: ReadingEntry[]
): ReadingCollection {
  let title = 'Writings';
  let items = all;
  if (segments[0] === 'tags') {
    if (segments.length === 2) {
      const tag = tagFromParam(segments[1]);
      title = `#${tag}`;
      items = all.filter((item) =>
        item.tags.some((value) => normalizeTag(value) === tag)
      );
      if (items.length === 0) notFound();
    } else if (segments.length !== 1) notFound();
  } else if (segments[0] === 'series' && segments.length === 2) {
    title = segments[1].replaceAll('-', ' ');
    items = all
      .filter((item) => item.series?.slug === segments[1])
      .sort((a, b) => (a.series?.part ?? 0) - (b.series?.part ?? 0));
    if (items.length === 0) notFound();
  } else if (segments.length > 0) notFound();

  return { title, items };
}

interface EditProps {
  entry: ReadingEntry;
}

function Edit({ entry }: EditProps) {
  return entry.editorId ? (
    <SiteLink
      href={`/studio/${entry.editorId}`}
      preview={false}
      className="link-animated text-label-large text-accent"
    >
      Edit writing
    </SiteLink>
  ) : (
    <ImportWriting slug={entry.slug} />
  );
}
interface TagsProps {
  tags: string[];
  filter?: boolean;
  currentTag?: string;
}

function Tags({ tags, filter = false, currentTag }: TagsProps) {
  return tags.length > 0 ? (
    <ul
      aria-label={filter ? 'Filter by tag' : 'Tags'}
      className="mt-4 flex flex-wrap gap-2"
    >
      {filter && (
        <li>
          <SiteLink
            href="/writings"
            preview={false}
            aria-current={!currentTag ? 'page' : undefined}
            className={
              !currentTag
                ? 'inline-block rounded-full bg-primary px-3 py-1.5 text-label-large text-on-primary'
                : 'inline-block rounded-full border border-line bg-card px-3 py-1.5 text-label-large text-ink transition-colors hover:border-accent hover:text-accent'
            }
          >
            All
          </SiteLink>
        </li>
      )}
      {tags.map((tag) => (
        <li key={tag}>
          <SiteLink
            href={tagPath(tag)}
            preview={false}
            aria-current={
              filter && currentTag === normalizeTag(tag) ? 'page' : undefined
            }
            className={
              filter && currentTag === normalizeTag(tag)
                ? 'inline-block rounded-full bg-primary px-3 py-1.5 text-label-large text-on-primary'
                : `inline-block rounded-full border border-line ${filter ? 'bg-card py-1.5 text-label-large' : 'bg-ground py-1 text-label-medium'} px-3 text-ink transition-colors hover:border-accent hover:text-accent`
            }
          >
            {tag}
          </SiteLink>
        </li>
      ))}
    </ul>
  ) : null;
}
export default async function Page(props: Props) {
  return await Reading(props);
}
