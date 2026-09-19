import { PagefindTrigger } from '@/components/search/pagefind';

import { railVentures } from '@/lib/home/ventures';
import { site } from '@/lib/site';

import { IndexRow } from './IndexRow';
import { FacetKey } from './Statement';

/**
 * The sticky column beside the grid: the headline and the venture list. It
 * is also the site's h-card, so the name and note are real, visible parts of
 * the page. The contact links sit at the foot of the rail but belong to the
 * footer, which grows out of them (SiteFooter), so the photo and email are
 * given here as data.
 */
export function Rail() {
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
            builds <FacetKey facet="software">software</FacetKey> and{' '}
            <FacetKey facet="systems">systems</FacetKey> for{' '}
            <FacetKey facet="people">people</FacetKey>.
          </h1>
          <div className="copy">
            <p className="description p-note">
              He runs{' '}
              <span className="name">Las Vegans for Better Transit</span>, the
              design lab <span className="name">Hypertext Studio</span>, and the{' '}
              <span className="name">Reasonable Tech Company</span>, where he’s
              building <span className="name">Project Lovelace</span>.
            </p>
          </div>
        </div>

        <div className="rail-search">
          <PagefindTrigger />
        </div>

        <nav className="index" aria-label="What he’s building">
          <h2>What he’s building</h2>
          <ul>
            {railVentures.map((venture) => (
              <IndexRow key={venture.id} venture={venture} />
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
