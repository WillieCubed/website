import { Fragment } from 'react';

import { type Initiative, type Part, partTitle } from '@/lib/initiatives';

import { formatRange, isoDate } from './dates';

interface PartEventProps {
  initiative: Pick<Initiative, 'title' | 'partLabel'>;
  part: Pick<
    Part,
    'number' | 'title' | 'tagline' | 'starts' | 'ends' | 'places'
  >;
  /** The part page's canonical URL. */
  url: string;
}

/**
 * The words over a part's cover, marked up as an h-event so a reader's
 * calendar or a parser can take the trip as an event. The name is the
 * standalone part title, because the event is read away from the page
 * (docs/metadata.md). The name, the URL, and the last day are `<data>`
 * elements because the page shows them some other way or not at all.
 */
export default function PartEvent({ initiative, part, url }: PartEventProps) {
  return (
    <div className="h-event relative flex min-h-[52vh] flex-col justify-end bg-gradient-to-t from-ink/80 via-ink/20 to-transparent p-6 medium:p-10">
      <data className="p-name" value={partTitle(initiative, part)} />
      <data className="u-url" value={url} />
      <p className="act-kicker text-label-large text-ground/85">
        {initiative.partLabel} {part.number}
      </p>
      <h1 className="mt-2 max-w-[18ch] text-display-medium text-ground">
        {part.title}
      </h1>
      {part.tagline && (
        <p className="p-summary mt-3 max-w-prose text-headline-small font-normal text-ground/90">
          {part.tagline}
        </p>
      )}
      <p className="mt-4 text-label-large text-ground/85">
        <time className="dt-start" dateTime={isoDate(part.starts)}>
          {formatRange(part.starts, part.ends, true)}
        </time>
        <data className="dt-end" value={isoDate(part.ends)} />
        {part.places.length > 0 && ' · '}
        {part.places.map((place, i) => (
          <Fragment key={place.name}>
            {i > 0 && ', '}
            <span className="p-location h-adr">
              <span className="p-locality">{place.name}</span>
              {place.region && (
                <data className="p-region" value={place.region} />
              )}
              <data className="p-latitude" value={String(place.lat)} />
              <data className="p-longitude" value={String(place.lng)} />
            </span>
          </Fragment>
        ))}
      </p>
    </div>
  );
}
