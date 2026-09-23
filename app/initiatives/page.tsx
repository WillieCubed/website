import Image from 'next/image';

import FeedAuthor from '@/components/indieweb/FeedAuthor';
import SiteLink from '@/components/link/SiteLink';
import JsonLd from '@/components/seo/JsonLd';
import TopBar from '@/components/site/TopBar';

import { currentPart, getInitiatives } from '@/lib/initiatives';
import { schemeStyleFromHex } from '@/lib/initiatives/theme';
import { graph, personLd, webPageLd, websiteLd } from '@/lib/seo/jsonld';
import { absoluteUrl, pageMetadata } from '@/lib/site';

const INITIATIVES = {
  title: 'Initiatives',
  description:
    'The campaigns, series, and projects Willie is running right now, each with its own page and story.',
  path: '/initiatives',
  image: '/initiatives/opengraph-image',
};

export const metadata = pageMetadata({
  ...INITIATIVES,
  imageAlt: 'Initiatives from Willie Chalmers III',
});

export default async function InitiativesPage() {
  const initiatives = await getInitiatives();
  return (
    <>
      <JsonLd
        data={graph(
          webPageLd({
            type: 'CollectionPage',
            name: INITIATIVES.title,
            description: INITIATIVES.description,
            path: INITIATIVES.path,
            image: INITIATIVES.image,
            items: initiatives.map((item) => ({
              name: item.title,
              path: item.href,
            })),
          }),
          websiteLd(),
          personLd()
        )}
      />
      <TopBar crumbs={[{ label: 'Initiatives', href: '/initiatives' }]} />
      <main id="main" className="h-feed mx-auto max-w-[1200px] px-5 pb-20">
        {/* h-feed: u-url so parsers know which page this feed is, and
            p-author so they know whose it is */}
        <a href={absoluteUrl('/initiatives')} className="u-url hidden" />
        <FeedAuthor />
        <h1 className="p-name text-display-small text-ink">Initiatives</h1>
        {initiatives.length === 0 && (
          <p className="mt-6 text-body-large text-muted">
            Nothing published yet.
          </p>
        )}
        <ul className="mt-10 grid list-none gap-5 p-0 medium:grid-cols-2 large:grid-cols-3">
          {initiatives.map((item) => {
            const act = currentPart(item);
            return (
              <li
                key={item.slug}
                className="initiative act-card h-entry relative overflow-hidden rounded-2xl"
                style={schemeStyleFromHex(item.brand)}
              >
                {item.cover && (
                  <div className="relative aspect-[3/2] bg-tray">
                    <Image
                      src={item.cover.src}
                      alt={item.cover.alt}
                      fill
                      sizes="(min-width: 1200px) 33vw, (min-width: 600px) 50vw, 100vw"
                      className="object-cover"
                      unoptimized={item.cover.src.endsWith('.svg')}
                    />
                  </div>
                )}
                <div className="p-5">
                  <h2 className="p-name mt-1 text-title-large text-ink">
                    <SiteLink
                      preview={false}
                      href={item.href}
                      className="u-url after:absolute after:inset-0 focus-visible:outline-none"
                    >
                      {item.title}
                    </SiteLink>
                  </h2>
                  <p className="p-summary mt-2 text-body-medium text-muted">
                    {item.tagline}
                  </p>
                  {act && (
                    <p className="mt-3 text-label-medium text-muted">
                      {item.partLabel} {act.number} · {act.title}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
