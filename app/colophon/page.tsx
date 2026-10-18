import SiteLink from '@/components/link/SiteLink';
import TopBar, { COLUMN } from '@/components/site/TopBar';

import { pageMetadata } from '@/lib/seo/metadata';
import { sitePage } from '@/lib/site/navigation';

import Credits from './Credits';
import './colophon.css';
import { PublishingIllustration, TeapotIllustration } from './illustrations';

const page = sitePage('/colophon');
export const metadata = pageMetadata({
  title: page.label,
  description: page.description,
  path: page.path,
});

/** A maker's note and the immutable provenance of the page being read. */
export default function ColophonPage() {
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
              of the old web, with <strong>human intent</strong> always at the
              forefront.
            </p>
            <p>
              The <SiteLink href="https://indieweb.org/">IndieWeb</SiteLink>{' '}
              ideas show up in practical ways: my work lives at my own address,
              posts are portable, and people can follow along and respond from
              their own websites.
            </p>
          </section>
          <section className="colophon-design" aria-labelledby="design-title">
            <h2 id="design-title">Design</h2>
            <div className="colophon-prose colophon-design-prose">
              <div className="colophon-design-notes">
                <p>
                  I like modern, playful illustrations that draw attention to
                  parts of a page.
                </p>
                <p>
                  Links should feel like links, and things that look interactive
                  should work. Keyboard access, reduced motion, and useful pages
                  without JavaScript are part of how I judge whether an
                  interaction belongs here.
                </p>
                <div className="colophon-coffee-note">
                  <TeapotIllustration />
                  <p>
                    There’s room for a joke, too: you can{' '}
                    <SiteLink href="/coffee">ask for coffee</SiteLink> and get a
                    teapot.
                  </p>
                </div>
              </div>
              <div className="colophon-type-notes">
                <h3 id="type-title">Type</h3>
                <p>
                  Atkinson Hyperlegible Next is used for reading, and Atkinson
                  Hyperlegible Mono for code and revision identifiers. Both come
                  from the{' '}
                  <SiteLink href="https://www.brailleinstitute.org/freefont/">
                    Braille Institute
                  </SiteLink>
                  . Their distinct character shapes help separate similar
                  letters and numbers.
                </p>
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
              </div>
            </div>
          </section>
          <section className="colophon-making" aria-labelledby="making-title">
            <h2 id="making-title">Making it</h2>
            <p>
              <span className="colophon-statement">
                Not a single line of code was written by hand.
              </span>
              I built this site with tools including Claude and Codex.
              Handwriting code isn’t really that important to me. I think one of
              the best uses of AI is efficiently creating workflows and
              interfaces catered to my exact taste, when I can properly describe
              it.
            </p>
            <p>
              <span className="colophon-statement">
                Developer experience is at the forefront, too.
              </span>
              I’m the maintainer, and it should be stupidly simple for me to do
              exactly what I want to do. The workflows are bespoke and need to
              be designed well, with my intent guiding how they work.
            </p>
          </section>
          <section
            className="colophon-publishing"
            aria-labelledby="publishing-title"
          >
            <h2 id="publishing-title">Publishing</h2>
            <div className="colophon-prose">
              <p>
                Everything in <SiteLink href="/writings">Writings</SiteLink> is
                written by me. Posts live at their own URLs. Markdown and MDX
                keep the published writing in text files alongside the site’s
                source, so the words can outlast a particular framework.
              </p>
              <p>
                Readers can follow along in the app they choose. Webmention
                connects responses from other websites to the posts they
                reference.
              </p>
            </div>
            <SiteLink className="colophon-feed-link" href="/sitemap">
              <PublishingIllustration />
              <span>RSS, Atom, and JSON feeds</span>
            </SiteLink>
          </section>
          <Credits />
        </div>
      </main>
    </>
  );
}
