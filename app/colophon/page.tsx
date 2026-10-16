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
            <div className="colophon-intro-copy">
              <p>
                My writing, software, music, and organizing, all at one address.
              </p>
              <p className="colophon-byline">
                Designed and built by{' '}
                <SiteLink href="/">Willie Chalmers III</SiteLink>.
              </p>
            </div>
          </div>
          <div className="colophon-illustration" aria-hidden="true">
            <span className="colophon-illustration-letters">Aa</span>
            <span className="colophon-illustration-glyphs">0O &nbsp; 1Il</span>
          </div>
        </section>

        <div className="colophon-notes">
          <section className="colophon-purpose" aria-labelledby="purpose-title">
            <h2 id="purpose-title">A place of my own</h2>
            <p className="colophon-lead">
              I’m building this website to follow IndieWeb principles and ideas
              of the old web, with human intent always at the forefront.
            </p>
            <p>
              The <SiteLink href="https://indieweb.org/">IndieWeb</SiteLink>{' '}
              ideas show up in practical ways: my work lives at my own address,
              posts are portable, and people can follow along and respond from
              their own websites.
            </p>
          </section>
          <section className="colophon-design" aria-labelledby="design-title">
            <div className="colophon-section-title">
              <h2 id="design-title">Design</h2>
              <svg
                className="colophon-decoration colophon-palette"
                viewBox="0 0 160 144"
                aria-hidden="true"
                focusable="false"
              >
                <ellipse
                  cx="73"
                  cy="82"
                  rx="61"
                  ry="47"
                  fill="var(--color-tertiary-container)"
                  transform="rotate(-16 73 82)"
                />
                <path
                  d="M87 13c8 21 13 26 34 34-21 8-26 13-34 34-8-21-13-26-34-34 21-8 26-13 34-34Z"
                  fill="var(--color-primary)"
                />
                <circle
                  cx="118"
                  cy="101"
                  r="25"
                  fill="var(--color-primary-container)"
                />
                <circle
                  cx="118"
                  cy="101"
                  r="8"
                  fill="var(--color-on-primary-container)"
                />
                <circle cx="38" cy="90" r="10" fill="var(--color-tertiary)" />
              </svg>
            </div>
            <div className="colophon-prose">
              <p>
                I like modern, playful illustrations that draw attention to
                parts of a page. There’s room for a joke, too: you can{' '}
                <SiteLink href="/coffee">ask for coffee</SiteLink> and get a
                teapot.
              </p>
              <p>
                Links should feel like links, and things that look interactive
                should work. Keyboard access, reduced motion, and useful pages
                without JavaScript are part of how I judge whether an
                interaction belongs here.
              </p>
              <h3 id="type-title">Type</h3>
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
            </div>
            <figure
              className="colophon-specimen"
              aria-label="Atkinson Hyperlegible type specimens"
            >
              <div className="colophon-type-sample colophon-type-sample--sans">
                <span className="colophon-sample-text">0O · 1Il</span>
                <span className="colophon-sample-name">
                  Atkinson Hyperlegible Next
                </span>
              </div>
              <div className="colophon-type-sample colophon-type-sample--mono">
                <span className="colophon-sample-text">0O · 1Il</span>
                <span className="colophon-sample-name">
                  Atkinson Hyperlegible Mono
                </span>
              </div>
            </figure>
          </section>
          <section className="colophon-making" aria-labelledby="making-title">
            <h2 id="making-title">Making it</h2>
            <p>
              Handwriting code isn’t really that important to me. I think one of
              the best uses of AI is efficiently creating workflows and
              interfaces catered to my exact taste, when I can properly describe
              it. That’s how I’m building the software behind this site.
            </p>
            <p>
              Developer experience is at the forefront, too. I’m the maintainer,
              and it should be stupidly simple for me to do exactly what I want
              to do. The workflows are bespoke and need to be designed well,
              with my intent guiding how they work.
            </p>
          </section>
          <section
            className="colophon-publishing"
            aria-labelledby="publishing-title"
          >
            <div className="colophon-section-title">
              <h2 id="publishing-title">Publishing</h2>
              <svg
                className="colophon-decoration colophon-paper"
                viewBox="0 0 160 152"
                aria-hidden="true"
                focusable="false"
              >
                <g transform="rotate(-9 74 77)">
                  <path
                    d="M34 16h57l27 27v78c0 9-7 16-16 16H34c-9 0-16-7-16-16V32c0-9 7-16 16-16Z"
                    fill="var(--color-primary-container)"
                  />
                  <path
                    d="M91 16v19c0 5 3 8 8 8h19Z"
                    fill="var(--color-primary)"
                  />
                  <path
                    d="M38 60h51M38 78h38M38 96h25"
                    fill="none"
                    stroke="var(--color-on-primary-container)"
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                </g>
                <circle
                  cx="122"
                  cy="114"
                  r="34"
                  fill="var(--color-tertiary-container)"
                />
                <g
                  fill="none"
                  stroke="var(--color-on-tertiary-container)"
                  strokeWidth="5"
                  strokeLinecap="round"
                >
                  <path d="M107 97c18 0 32 14 32 32M107 112c9 0 17 8 17 17" />
                </g>
                <circle
                  cx="107"
                  cy="129"
                  r="3"
                  fill="var(--color-on-tertiary-container)"
                />
              </svg>
            </div>
            <div className="colophon-prose">
              <p>
                Everything in <SiteLink href="/writings">Writings</SiteLink> is
                written by me. Posts live at their own URLs. Markdown and MDX
                keep the published writing in text files alongside the site’s
                source, so the words can outlast a particular framework.
              </p>
              <p>
                <SiteLink href="/sitemap">RSS, Atom, and JSON feeds</SiteLink>{' '}
                let readers follow along in the app they choose. Webmention
                connects responses from other websites to the posts they
                reference.
              </p>
            </div>
          </section>
          <section className="colophon-credits" aria-labelledby="credits-title">
            <h2 id="credits-title">Credits</h2>
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
