import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';

import PageWebmentions from '@/components/indieweb/PageWebmentions';
import InitiativeBody from '@/components/initiatives/InitiativeBody';
import Playbill from '@/components/initiatives/Playbill';
import RouteMap from '@/components/initiatives/RouteMap';
import TrailerBlock from '@/components/initiatives/TrailerBlock';
import { initiativeBreadcrumbs } from '@/components/initiatives/breadcrumbs';
import '@/components/initiatives/fall-tour.css';
import SiteLink from '@/components/link/SiteLink';
import JsonLd from '@/components/seo/JsonLd';
import SharedTitle from '@/components/site/SharedTitle';
import TopBar from '@/components/site/TopBar';

import { publishedLinks } from '@/lib/entities/registry';
import { formatRange } from '@/lib/initiatives/dates';
import {
  type Initiative,
  getChildInitiatives,
  getInitiative,
  getInitiativeSlugs,
} from '@/lib/initiatives/index';
import { uniquePlaces } from '@/lib/initiatives/places';
import { schemeStyleFromHex } from '@/lib/initiatives/theme';
import { initiativeViewport } from '@/lib/initiatives/viewport';
import {
  breadcrumbLd,
  graph,
  personLd,
  webPageLd,
  websiteLd,
} from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/seo/metadata';
import { absoluteUrl } from '@/lib/site/urls';

// Cache Components refuses an empty list at build time. When nothing is
// published, one underscore path stands in: the loaders treat the prefix
// as hidden, so it prerenders as a plain 404 and no draft is involved.
export async function generateStaticParams() {
  const slugs = await getInitiativeSlugs();
  return slugs.length > 0 ? slugs.map((slug) => ({ slug })) : [{ slug: '_' }];
}

export async function generateMetadata(
  props: PageProps<'/initiatives/[slug]'>
): Promise<Metadata> {
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
export async function generateViewport(
  props: PageProps<'/initiatives/[slug]'>
): Promise<Viewport> {
  const { slug } = await props.params;
  return initiativeViewport(slug);
}

interface InitiativeHeadingProps {
  initiative: Initiative;
}

function InitiativeHeading({ initiative }: InitiativeHeadingProps) {
  return (
    <header className="initiative-heading mx-auto max-w-[840px]">
      <h1 className="mt-2 text-display-medium text-ink">
        <SharedTitle id={`initiative-${initiative.slug}`} size="large">
          <span className="inline-block">{initiative.title}</span>
        </SharedTitle>
      </h1>
      <p className="initiative-tagline mt-3 text-headline-small font-normal text-muted">
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
            className="initiative-site site-control gap-2 px-5 py-3 text-label-large font-semibold"
          >
            Visit {new URL(initiative.website).hostname}
            <span aria-hidden="true">↗</span>
          </SiteLink>
        </p>
      )}
    </header>
  );
}

export default async function InitiativePage(
  props: PageProps<'/initiatives/[slug]'>
) {
  const { slug } = await props.params;
  let initiative;
  try {
    initiative = await getInitiative(slug);
  } catch {
    notFound();
  }
  const children = await getChildInitiatives(slug);
  const links = await publishedLinks(initiative.links);
  const places = uniquePlaces(initiative.parts.flatMap((part) => part.places));
  const crumbs = await initiativeBreadcrumbs(initiative);

  return (
    <div
      className="initiative initiative-overview"
      data-initiative={initiative.slug}
      style={schemeStyleFromHex(initiative.brand)}
    >
      <JsonLd
        data={graph(
          webPageLd({
            name: initiative.title,
            description: initiative.description,
            path: initiative.href,
            image: `${initiative.href}/opengraph-image`,
          }),
          breadcrumbLd([
            ...crumbs.map((crumb) => ({ name: crumb.label, path: crumb.href })),
            { name: initiative.title, path: initiative.href },
          ]),
          websiteLd(),
          personLd()
        )}
      />
      <TopBar
        crumbs={[
          ...crumbs,
          {
            label: initiative.title,
            href: initiative.href,
            menuItems: initiative.parts.map((part) => ({
              label: `${initiative.partLabel} ${part.number}: ${part.title}`,
              href: `${initiative.href}/${part.slug}`,
            })),
          },
        ]}
        column={initiative.slug === 'fall-tour-2026' ? 'wide' : 'content'}
      />
      <main id="main" className="site-frame site-frame--wide pb-20">
        <div className="initiative-introduction">
          <InitiativeHeading initiative={initiative} />

          <div
            className="initiative-trailer mx-auto mt-8 max-w-[840px]"
            data-media={initiative.trailer?.youtubeId ? 'video' : 'poster'}
          >
            <TrailerBlock initiative={initiative} />
          </div>
        </div>

        {initiative.parts.length > 0 && (
          <section
            className="initiative-chapters mt-12"
            aria-label={`${initiative.title} ${initiative.partLabel.toLowerCase()}s`}
          >
            <Playbill
              initiative={initiative}
              showCovers={initiative.slug !== 'fall-tour-2026'}
            />
          </section>
        )}

        {places.length > 1 && (
          <section
            className="initiative-route mt-12"
            aria-label={`${initiative.title} route`}
          >
            <RouteMap
              places={places}
              routes={initiative.parts.map((part) => ({
                label: `${initiative.partLabel} ${part.number}`,
                places: part.places,
              }))}
              title={`${initiative.title} route`}
            />
          </section>
        )}

        <section className="initiative-story mx-auto mt-12 max-w-[720px]">
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

        {links.length > 0 && (
          <nav
            className="mx-auto mt-12 max-w-[720px]"
            aria-label="Related links"
          >
            <ul className="flex list-none flex-wrap gap-2 p-0">
              {links.map((link) => (
                <li key={link.href}>
                  <SiteLink
                    href={link.href}
                    className="site-control px-4 py-2 text-label-large [--control-ink:var(--color-ink)] [--control-border:1px_solid_var(--color-line)]"
                  >
                    {link.label}
                  </SiteLink>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <PageWebmentions
          target={absoluteUrl(initiative.href)}
          className="mx-auto mt-12 max-w-[720px]"
        />
      </main>
    </div>
  );
}
