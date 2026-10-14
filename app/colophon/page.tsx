import SiteLink from '@/components/link/SiteLink';
import TopBar, { COLUMN } from '@/components/site/TopBar';

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
      <main id="main" className={`colophon ${COLUMN.content}`}>
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
          <table className="colophon-build">
            <caption id="edition-title">This build</caption>
            <tbody>
              <tr>
                <th scope="row">Version</th>
                <td>
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
                  {build.development && (
                    <span className="colophon-detail">Development</span>
                  )}
                </td>
              </tr>
              <tr>
                <th scope="row">Last built</th>
                <td>
                  {builtAt ? (
                    <time dateTime={build.builtAt!}>
                      {buildDate} · {buildTime}
                    </time>
                  ) : (
                    'Development server'
                  )}
                </td>
              </tr>
              <tr>
                <th scope="row">Build record</th>
                <td>
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
                  {build.provider === 'cloudflare' && (
                    <span className="colophon-detail">Sign-in required</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <div className="colophon-notes">
          <section aria-labelledby="personal-title">
            <h2 id="personal-title">A place of my own.</h2>
            <div>
              <p>
                I keep my writing, software, music, and organizing here. It
                gives the different parts of my work one address.
              </p>
              <p>
                Posts have permanent URLs and feeds. You can follow the writing
                in your own reader and send a response from another site through
                Webmention.
              </p>
              <p>
                The <SiteLink href="/status">status page</SiteLink> keeps a
                small window onto where I am.
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
                supplies the types, and{' '}
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
                Writing lives in Markdown and MDX files. The site’s code lives
                in a Git repository; each build records the revision it came
                from.
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
                .
              </p>
              <p>
                The <SiteLink href="/brand">brand kit</SiteLink> has the
                WillieCubed mark, colors, and downloadable assets. The source is
                on{' '}
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
