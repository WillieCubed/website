import PaletteTrigger from '@/components/palette/PaletteTrigger';

import { site } from '@/lib/site';

import { type FocusItem, Focuses, VentureLink } from './Focuses';

/**
 * The sticky column beside the grid: the headline, where Willie works, and
 * what he is working toward. It is also the site's h-card, so the name and note are real, visible parts of
 * the page. The contact links sit at the foot of the rail but belong to the
 * footer, which grows out of them (SiteFooter), so the photo and email are
 * given here as data.
 */
export function Rail({ focuses }: { focuses: FocusItem[] }) {
  return (
    <aside className="rail h-card">
      <data
        className="u-photo"
        value={new URL(site.author.photo, site.origin).href}
      />
      <data className="u-email" value={`mailto:${site.author.email}`} />
      <div className="lead">
        <div className="intro">
          <h1 className="statement">
            {/* The footer's name arrives as this one leaves the screen. */}
            <a
              className="p-name u-url u-uid"
              href={`${site.origin}/`}
              data-footer-anchor
            >
              <b>{site.author.name}</b>
            </a>{' '}
            builds software and systems for people.
          </h1>
          <div className="copy">
            <p className="description p-note">
              He runs{' '}
              <VentureLink id="lvbt">Las Vegans for Better Transit</VentureLink>
              , the design lab{' '}
              <VentureLink id="hypertext">Hypertext Studio</VentureLink>, and
              the <VentureLink id="rtc">Reasonable Tech Company</VentureLink>,
              where he’s building Project Lovelace.
            </p>
          </div>
        </div>

        <div className="rail-search">
          <PaletteTrigger size="rail" />
        </div>

        <Focuses items={focuses} />
      </div>
    </aside>
  );
}
