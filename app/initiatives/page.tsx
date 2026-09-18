import Image from 'next/image';

import SiteLink from '@/components/link/SiteLink';
import TopBar from '@/components/site/TopBar';

import { currentPart, getInitiatives } from '@/lib/initiatives';
import { schemeStyleFromHex } from '@/lib/initiatives/theme';
import { pageMetadata } from '@/lib/site';

export const metadata = pageMetadata({
  title: 'Initiatives',
  description:
    'The campaigns, series, and projects Willie is running right now, each with its own page and story.',
  path: '/initiatives',
});

const KIND_LABEL = {
  campaign: 'Campaign',
  series: 'Series',
  project: 'Project',
};

export default async function InitiativesPage() {
  const initiatives = await getInitiatives();
  return (
    <>
      <TopBar crumbs={[{ label: 'Initiatives', href: '/initiatives' }]} />
      <main className="mx-auto max-w-[1200px] px-5 pb-20">
        <h1 className="text-display-small text-ink">Initiatives</h1>
        <p className="mt-3 max-w-prose text-body-large text-muted">
          The things Willie is running on purpose, each with a page of its own.
        </p>
        <ul className="mt-10 grid list-none gap-5 p-0 medium:grid-cols-2 large:grid-cols-3">
          {initiatives.map((item) => {
            const act = currentPart(item);
            return (
              <li
                key={item.slug}
                className="initiative act-card relative overflow-hidden rounded-2xl"
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
                  <p className="act-kicker text-label-medium">
                    {KIND_LABEL[item.kind]}
                    {item.parent && ` · part of ${item.parent.toUpperCase()}`}
                  </p>
                  <h2 className="mt-1 text-title-large text-ink">
                    <SiteLink
                      preview={false}
                      href={item.href}
                      className="after:absolute after:inset-0 focus-visible:outline-none"
                    >
                      {item.title}
                    </SiteLink>
                  </h2>
                  <p className="mt-2 text-body-medium text-muted">
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
