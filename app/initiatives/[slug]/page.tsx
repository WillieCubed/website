import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';

import InitiativeBody from '@/components/initiatives/InitiativeBody';
import Playbill from '@/components/initiatives/Playbill';
import RouteMap from '@/components/initiatives/RouteMap';
import TrailerBlock from '@/components/initiatives/TrailerBlock';
import { formatRange } from '@/components/initiatives/dates';
import SiteLink from '@/components/link/SiteLink';
import JsonLd from '@/components/seo/JsonLd';
import TopBar from '@/components/site/TopBar';

import {
  getChildInitiatives,
  getInitiative,
  getInitiativeSlugs,
} from '@/lib/initiatives';
import { schemeStyleFromHex } from '@/lib/initiatives/theme';
import { initiativeViewport } from '@/lib/initiatives/viewport';
import { breadcrumbLd, graph } from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/site';

// Cache Components refuses an empty list at build time. When nothing is
// published, one underscore path stands in: the loaders treat the prefix
// as hidden, so it prerenders as a plain 404 and no draft is involved.
export async function generateStaticParams() {
  const slugs = await getInitiativeSlugs();
  return slugs.length > 0 ? slugs.map((slug) => ({ slug })) : [{ slug: '_' }];
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  try {
    const initiative = await getInitiative(slug);
    return pageMetadata({
      title: initiative.title,
      description: initiative.description,
      path: initiative.href,
      image: `${initiative.href}/opengraph-image`,
      imageAlt: `${initiative.title}: ${initiative.tagline}`,
      labels:
        initiative.starts && initiative.ends
          ? [['Dates', formatRange(initiative.starts, initiative.ends, true)]]
          : undefined,
    });
  } catch {
    notFound();
  }
}

/** Tints the browser chrome with the initiative's brand colour. */
export async function generateViewport(props: {
  params: Promise<{ slug: string }>;
}): Promise<Viewport> {
  const { slug } = await props.params;
  return initiativeViewport(slug);
}

export default async function InitiativePage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  let initiative;
  try {
    initiative = await getInitiative(slug);
  } catch {
    notFound();
  }
  const parent = initiative.parent
    ? await getInitiative(initiative.parent).catch(() => null)
    : null;
  const children = await getChildInitiatives(slug);
  const places = initiative.parts
    .flatMap((part) => part.places)
    .filter(
      (place, i, all) => all.findIndex((p) => p.name === place.name) === i
    );
  const crumbs = [{ label: 'Initiatives', href: '/initiatives' }];
  if (parent) crumbs.push({ label: parent.title, href: parent.href });

  return (
    <div className="initiative" style={schemeStyleFromHex(initiative.brand)}>
      <JsonLd
        data={graph(
          breadcrumbLd([
            ...crumbs.map((crumb) => ({ name: crumb.label, path: crumb.href })),
            { name: initiative.title, path: initiative.href },
          ])
        )}
      />
      <TopBar crumbs={crumbs} column="content" />
      <main id="main" className="mx-auto max-w-[1200px] px-5 pb-20">
        <header className="mx-auto max-w-[840px]">
          <h1 className="mt-2 text-display-medium text-ink">
            {initiative.title}
          </h1>
          <p className="mt-3 text-headline-small font-normal text-muted">
            {initiative.tagline}
          </p>
          {initiative.starts && initiative.ends && (
            <p className="mt-2 text-label-large text-muted">
              {formatRange(initiative.starts, initiative.ends, true)}
            </p>
          )}
          {initiative.website && (
            <p className="mt-6">
              <SiteLink
                href={initiative.website}
                className="initiative-site inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-label-large font-semibold"
              >
                Visit {new URL(initiative.website).hostname}
                <span aria-hidden="true">↗</span>
              </SiteLink>
            </p>
          )}
        </header>

        <div className="mx-auto mt-8 max-w-[840px]">
          <TrailerBlock initiative={initiative} />
        </div>

        {initiative.parts.length > 0 && (
          <section
            className="mt-12"
            aria-label={`${initiative.title} ${initiative.partLabel.toLowerCase()}s`}
          >
            <Playbill initiative={initiative} />
          </section>
        )}

        {places.length > 1 && (
          <section className="mt-12" aria-label={`${initiative.title} route`}>
            <RouteMap places={places} title={`${initiative.title} route`} />
          </section>
        )}

        <section className="mx-auto mt-12 max-w-[720px]">
          <InitiativeBody source={initiative.content} />
        </section>

        {children.length > 0 && (
          <section
            className="mx-auto mt-12 max-w-[720px]"
            aria-label={`Inside ${initiative.title}`}
          >
            <ul className="grid list-none gap-3 p-0">
              {children.map((child) => (
                <li key={child.slug} className="act-card rounded-2xl p-4">
                  <SiteLink
                    href={child.href}
                    className="text-title-medium text-ink hover:underline"
                  >
                    {child.title}
                  </SiteLink>
                  <p className="mt-1 text-body-medium text-muted">
                    {child.tagline}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {initiative.links.length > 0 && (
          <nav
            className="mx-auto mt-12 max-w-[720px]"
            aria-label="Related links"
          >
            <ul className="flex list-none flex-wrap gap-2 p-0">
              {initiative.links.map((link) => (
                <li key={link.href}>
                  <SiteLink
                    href={link.href}
                    className="inline-block rounded-full border border-line px-4 py-2 text-label-large text-ink transition-colors hover:bg-tray"
                  >
                    {link.label}
                  </SiteLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </main>
    </div>
  );
}
