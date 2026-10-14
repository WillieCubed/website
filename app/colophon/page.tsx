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
            <h1 id="colophon-title">Colophon</h1>
            <p>
              Designed and built by{' '}
              <SiteLink href="/">Willie Chalmers III</SiteLink>.
            </p>
          </div>
          <div className="colophon-illustration" aria-hidden="true">
            <span className="colophon-illustration-letters">Aa</span>
            <span className="colophon-illustration-glyphs">0O &nbsp; 1Il</span>
          </div>
        </section>

        <div className="colophon-notes">
          <section className="colophon-type" aria-labelledby="type-title">
            <h2 id="type-title">Type</h2>
            <p>
              Atkinson Hyperlegible Next is used for reading, and Atkinson
              Hyperlegible Mono for code and revision identifiers. Both come
              from the{' '}
              <SiteLink href="https://www.brailleinstitute.org/freefont/">
                Braille Institute
              </SiteLink>
              . Their distinct character shapes help separate similar letters
              and numbers.
            </p>
            <figure
              className="colophon-specimen"
              aria-label="Atkinson Hyperlegible type specimens"
            >
              <div className="colophon-type-sample colophon-type-sample--sans">
                <span className="colophon-sample-text">Aa 0O 1Il</span>
                <span className="colophon-sample-name">
                  Atkinson Hyperlegible Next
                </span>
              </div>
              <div className="colophon-type-sample colophon-type-sample--mono">
                <span className="colophon-sample-text">Aa 0O 1Il</span>
                <span className="colophon-sample-name">
                  Atkinson Hyperlegible Mono
                </span>
              </div>
            </figure>
          </section>
          <section
            className="colophon-publishing"
            aria-labelledby="publishing-title"
          >
            <h2 id="publishing-title">Publishing</h2>
            <p>
              Original posts live here at their own URLs. Markdown and MDX keep
              the writing in text files alongside the site’s source, so the
              words can outlast a particular framework.
            </p>
            <p>
              <SiteLink href="/sitemap">RSS, Atom, and JSON feeds</SiteLink> let
              readers follow along in the app they choose. Webmention connects
              responses from other websites to the posts they reference.
            </p>
          </section>
          <section className="colophon-credits" aria-labelledby="credits-title">
            <h2 id="credits-title">Source and credits</h2>
            <p>
              The source is on{' '}
              <SiteLink href="https://github.com/WillieCubed/website">
                GitHub
              </SiteLink>
              . The <SiteLink href="/brand">brand kit</SiteLink> contains the
              WillieCubed mark, colors, and downloadable assets.
            </p>
            <p className="colophon-tools">
              Built with <SiteLink href="https://nextjs.org/">Next.js</SiteLink>
              , <SiteLink href="https://react.dev/">React</SiteLink>,{' '}
              <SiteLink href="https://www.typescriptlang.org/">
                TypeScript
              </SiteLink>
              , and{' '}
              <SiteLink href="https://tailwindcss.com/">Tailwind CSS</SiteLink>;
              hosted on{' '}
              <SiteLink href="https://workers.cloudflare.com/">
                Cloudflare Workers
              </SiteLink>
              .{' '}
              <a
                // eslint-disable-next-line site/no-raw-internal-anchor -- A plain-text route handler, not a page.
                href="/humans.txt"
              >
                Plain-text credits (humans.txt)
              </a>
              .
            </p>
            <section
              className="colophon-edition"
              aria-labelledby="edition-title"
            >
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
                          <span aria-hidden="true">↗</span>
                        </SiteLink>
                      ) : (
                        'Built locally'
                      )}
                      {build.provider === 'cloudflare' && (
                        <span className="colophon-detail">
                          Sign-in required
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          </section>
        </div>
      </main>
    </>
  );
}
