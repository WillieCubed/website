import type { Metadata, Viewport } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import PageWebmentions from '@/components/indieweb/PageWebmentions';
import InitiativeBody from '@/components/initiatives/InitiativeBody';
import PartEvent from '@/components/initiatives/PartEvent';
import PartNav from '@/components/initiatives/PartNav';
import RouteMap from '@/components/initiatives/RouteMap';
import {
  formatDay,
  formatRange,
  isoDate,
} from '@/components/initiatives/dates';
import SiteLink from '@/components/link/SiteLink';
import JsonLd from '@/components/seo/JsonLd';
import TopBar from '@/components/site/TopBar';

import {
  getInitiative,
  getInitiativeSlugs,
  getPart,
  partTitle,
} from '@/lib/initiatives';
import { schemeStyleFromHex } from '@/lib/initiatives/theme';
import { initiativeViewport } from '@/lib/initiatives/viewport';
import {
  breadcrumbLd,
  eventLd,
  graph,
  personLd,
  webPageLd,
  websiteLd,
} from '@/lib/seo/jsonld';
import { absoluteUrl, canonicalUrl, pageMetadata } from '@/lib/site';

// Cache Components refuses an empty list at build time. When nothing is
// published, one underscore path stands in: the loaders treat the prefix
// as hidden, so it prerenders as a plain 404 and no draft is involved.
export async function generateStaticParams() {
  const slugs = await getInitiativeSlugs();
  const params: Array<{ slug: string; part: string }> = [];
  for (const slug of slugs) {
    const initiative = await getInitiative(slug);
    for (const part of initiative.parts) {
      params.push({ slug, part: part.slug });
    }
  }
  return params.length > 0 ? params : [{ slug: '_', part: 'part-1' }];
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string; part: string }>;
}): Promise<Metadata> {
  const { slug, part: partSlug } = await props.params;
  const found = await getPart(slug, partSlug).catch(() => null);
  if (!found) notFound();
  const { initiative, part } = found;
  const labels: Array<[string, string]> = [
    ['When', formatRange(part.starts, part.ends, true)],
  ];
  if (part.places.length > 0) {
    labels.push(['Where', part.places.map((place) => place.name).join(', ')]);
  }
  return pageMetadata({
    title: partTitle(initiative, part),
    description: part.description || part.tagline || initiative.description,
    path: `${initiative.href}/${part.slug}`,
    image: `${initiative.href}/${part.slug}/opengraph-image`,
    type: 'article',
    labels,
  });
}

/** Tints the browser chrome with the initiative's brand colour. */
export async function generateViewport(props: {
  params: Promise<{ slug: string; part: string }>;
}): Promise<Viewport> {
  const { slug } = await props.params;
  return initiativeViewport(slug);
}

export default async function PartPage(props: {
  params: Promise<{ slug: string; part: string }>;
}) {
  const { slug, part: partSlug } = await props.params;
  const found = await getPart(slug, partSlug).catch(() => null);
  if (!found) notFound();
  const { initiative, part } = found;
  const cover = part.cover ?? initiative.cover;
  const partPath = `${initiative.href}/${part.slug}`;
  const actTitle = `${initiative.partLabel} ${part.number}: ${part.title}`;
  // One trail feeds the top bar and the breadcrumb markup, and it includes a
  // parent initiative the way the initiative page does.
  const parent = initiative.parent
    ? await getInitiative(initiative.parent).catch(() => null)
    : null;
  const crumbs = [{ label: 'Initiatives', href: '/initiatives' }];
  if (parent) crumbs.push({ label: parent.title, href: parent.href });
  crumbs.push({ label: initiative.title, href: initiative.href });
  const name = partTitle(initiative, part);
  const description =
    part.description || part.tagline || initiative.description;
  const partGraph = graph(
    webPageLd({
      name,
      description,
      path: partPath,
      image: `${partPath}/opengraph-image`,
    }),
    eventLd({
      name,
      description,
      path: partPath,
      startDate: isoDate(part.starts),
      endDate: isoDate(part.ends),
      places: part.places,
      image: `${partPath}/opengraph-image`,
    }),
    breadcrumbLd([
      ...crumbs.map((crumb) => ({ name: crumb.label, path: crumb.href })),
      { name: actTitle, path: partPath },
    ]),
    websiteLd(),
    personLd()
  );

  return (
    <div className="initiative" style={schemeStyleFromHex(initiative.brand)}>
      <JsonLd data={partGraph} />
      <TopBar crumbs={crumbs} />
      <main id="main" className="mx-auto max-w-[1200px] px-5 pb-20">
        <header className="relative overflow-hidden rounded-3xl bg-ink text-ground">
          {cover && (
            <Image
              src={cover.src}
              alt={cover.alt}
              fill
              priority
              sizes="(min-width: 1200px) 1200px, 100vw"
              className="object-cover opacity-80"
              unoptimized={cover.src.endsWith('.svg')}
            />
          )}
          <PartEvent
            initiative={initiative}
            part={part}
            url={canonicalUrl(partPath)}
          />
        </header>

        <div className="mx-auto mt-10 grid max-w-[1000px] gap-10 expanded:grid-cols-[1fr_320px]">
          <article className="min-w-0">
            <InitiativeBody source={part.content} />
          </article>
          <aside className="grid content-start gap-6">
            {part.milestones.length > 0 && (
              <section
                className="act-card rounded-2xl p-4"
                aria-label="Milestones"
              >
                <ol className="grid list-none gap-3 p-0">
                  {part.milestones.map((m) => (
                    <li key={m.id} className="grid gap-0.5">
                      <time
                        dateTime={isoDate(m.date)}
                        className="text-label-medium text-muted"
                      >
                        {formatDay(m.date)}
                      </time>
                      <span className="text-body-medium text-ink">
                        {m.label}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {part.places.length > 1 && (
              <RouteMap places={part.places} title={`${part.title} places`} />
            )}
          </aside>
        </div>

        <PageWebmentions
          target={absoluteUrl(partPath)}
          className="mx-auto mt-12 max-w-[1000px]"
        />

        <PartNav initiative={initiative} part={part} />
      </main>
    </div>
  );
}
