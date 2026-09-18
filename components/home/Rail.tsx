import { railVentures } from '@/lib/home/ventures';
import { site } from '@/lib/site';

import { IndexRow } from './IndexRow';
import { FacetKey } from './Statement';

/**
 * The sticky column beside the grid: the headline, the venture list, and
 * the contact links. It is also the site's h-card, so the name, photo, note,
 * and rel="me" links are real, visible parts of the page.
 */
export function Rail() {
  return (
    <aside className="rail h-card">
      <div className="lead">
        <div className="intro">
          <h1 className="statement">
            <a className="p-name u-url" href={site.origin}>
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

        <nav className="index" aria-label="What he’s building">
          <h2>What he’s building</h2>
          <ul>
            {railVentures.map((venture) => (
              <IndexRow key={venture.id} venture={venture} />
            ))}
          </ul>
        </nav>
      </div>

      <div className="rail-foot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="u-photo foot-photo"
          src={site.author.photo}
          alt=""
          width={28}
          height={28}
        />
        <a className="u-email" href={`mailto:${site.author.email}`}>
          Email
        </a>
        {site.social.map((profile) => (
          <a className="u-url" rel="me" href={profile.href} key={profile.href}>
            {profile.label}
          </a>
        ))}
      </div>
    </aside>
  );
}
