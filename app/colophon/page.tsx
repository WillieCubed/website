import SiteLink from '@/components/link/SiteLink';
import TopBar from '@/components/site/TopBar';

import { pageMetadata } from '@/lib/seo/metadata';
import { siteBuild } from '@/lib/site/build';
import { site } from '@/lib/site/identity';
import { sitePage } from '@/lib/site/navigation';

import './colophon.css';

const page = sitePage('/colophon');
export const metadata = pageMetadata({
  title: page.label,
  description: page.description,
  path: page.path,
});

/** A maker's note and the immutable provenance of the page being read. */
export default function ColophonPage() {
  const build = siteBuild();
  const builtAt = build.builtAt ? new Date(build.builtAt) : null;
  const buildDate =
    builtAt &&
    new Intl.DateTimeFormat('en-US', {
      timeZone: site.timeZone,
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(builtAt);
  const buildTime =
    builtAt &&
    new Intl.DateTimeFormat('en-US', {
      timeZone: site.timeZone,
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(builtAt);

  return (
    <>
      <TopBar
        column="content"
        crumbs={[{ label: page.label, href: page.path }]}
      />
      <main id="main" className="colophon">
        <section className="colophon-intro" aria-labelledby="colophon-title">
          <div className="colophon-welcome">
            <h1 id="colophon-title">A little about how this place is made.</h1>
            <p>
              I built this site as a home for the things I make, the ideas I’m
              working through, and the life happening around them. Here’s what
              goes into it.
            </p>
          </div>
          <figure className="colophon-specimen">
            <div className="colophon-letterpress" aria-hidden="true">
              <span className="colophon-letters">Aa</span>
              <span className="colophon-glyphs">0O &nbsp; 1Il</span>
            </div>
            <figcaption>
              A few characters from{' '}
              <SiteLink href="https://www.brailleinstitute.org/freefont/">
                Atkinson Hyperlegible
              </SiteLink>
              , the type family you’re reading.
            </figcaption>
          </figure>
        </section>

        <section className="colophon-edition" aria-labelledby="edition-title">
          <h2 id="edition-title">The version you’re visiting</h2>
          <dl className="colophon-build">
            <div>
              <dt>Current version</dt>
              <dd>
                {build.revision ? (
                  <SiteLink
                    className="colophon-revision"
                    href={`https://github.com/WillieCubed/website/commit/${build.revision}`}
                    aria-label={`View source for revision ${build.revision}`}
                  >
                    {build.revision.slice(0, 8)}
                  </SiteLink>
                ) : (
                  'Revision unavailable'
                )}
              </dd>
              <dd className="colophon-detail">
                {build.development ? 'Development checkout' : 'Source revision'}
              </dd>
            </div>
            <div>
              <dt>Last built</dt>
              <dd>
                {builtAt ? (
                  <time dateTime={build.builtAt!}>
                    {buildDate}
                    <span className="colophon-detail">{buildTime}</span>
                  </time>
                ) : (
                  'Development server'
                )}
              </dd>
            </div>
            <div>
              <dt>Build record</dt>
              <dd>
                {build.buildUrl ? (
                  <SiteLink href={build.buildUrl}>
                    {build.provider === 'cloudflare'
                      ? 'Cloudflare build'
                      : 'GitHub Actions run'}{' '}
                    ↗
                  </SiteLink>
                ) : (
                  'Built locally'
                )}
              </dd>
              <dd className="colophon-detail">
                {build.provider === 'cloudflare'
                  ? 'Cloudflare sign-in required'
                  : build.buildUrl
                    ? 'The run that made this version'
                    : 'No CI run for this build'}
              </dd>
            </div>
          </dl>
          <p className="colophon-build-note">
            This records when the site’s code was built. Writing and live
            information can change between builds.
          </p>
        </section>

        <div className="colophon-notes">
          <section aria-labelledby="personal-title">
            <h2 id="personal-title">Made to feel personal.</h2>
            <div>
              <p>
                A personal website has room to be a little playful. Warm colors,
                soft shapes, and small discoveries make this one feel like
                somewhere I’d want to spend time.
              </p>
              <p>
                That playfulness should help you find your way. Links look like
                links. Motion follows what you open or change, and steps aside
                when you prefer less of it. The content and navigation work
                without JavaScript.
              </p>
              <p>
                The <SiteLink href="/status">status page</SiteLink> is a small
                example: a place, a time, and a little weather, with a few
                things to try.
              </p>
            </div>
          </section>
          <section aria-labelledby="web-title">
            <h2 id="web-title">Built for the web.</h2>
            <div>
              <p>
                <SiteLink href="https://nextjs.org/">Next.js</SiteLink> and{' '}
                <SiteLink href="https://react.dev/">React</SiteLink> bring the
                pages together.{' '}
                <SiteLink href="https://www.typescriptlang.org/">
                  TypeScript
                </SiteLink>{' '}
                helps keep the pieces in agreement, and{' '}
                <SiteLink href="https://tailwindcss.com/">
                  Tailwind CSS
                </SiteLink>{' '}
                shares the site’s design tokens across them. The site runs on{' '}
                <SiteLink href="https://workers.cloudflare.com/">
                  Cloudflare Workers
                </SiteLink>
                .
              </p>
              <p>
                Writing lives in Markdown and MDX. Feeds let you follow along in
                your own reader, and Webmention lets other websites send a
                response. Those connections are part of what makes having a
                place on the open web worthwhile.
              </p>
              <p>
                You can find the{' '}
                <SiteLink href="/sitemap">
                  feeds and the rest of the site
                </SiteLink>{' '}
                in the sitemap.
              </p>
            </div>
          </section>
          <section aria-labelledby="credits-title">
            <h2 id="credits-title">A few credits.</h2>
            <div>
              <p>
                The type is Atkinson Hyperlegible Next and Atkinson Hyperlegible
                Mono, from the{' '}
                <SiteLink href="https://www.brailleinstitute.org/freefont/">
                  Braille Institute
                </SiteLink>
                . Their distinct letterforms put legibility first; the specimen
                above shows some characters that are easy to confuse.
              </p>
              <p>
                The colors and{' '}
                <SiteLink href="/brand">WillieCubed identity</SiteLink> belong
                to the same family as the rest of my work. The source is on{' '}
                <SiteLink href="https://github.com/WillieCubed/website">
                  GitHub
                </SiteLink>{' '}
                if you’d like to look around.
              </p>
              <p>
                For the plain-text credits and a longer list of tools and web
                standards, there’s{' '}
                <a
                  // eslint-disable-next-line site/no-raw-internal-anchor -- A plain-text route handler, not a page.
                  href="/humans.txt"
                >
                  humans.txt
                </a>
                .
              </p>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
