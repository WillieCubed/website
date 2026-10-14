import { typeFamilies, typeScale } from '@/brand/type-scale.mjs';
import type { CSSProperties } from 'react';

import SiteLink from '@/components/link/SiteLink';

type TypeRole = (typeof typeScale)[number];

function roleStyle(role: TypeRole): CSSProperties {
  const token = `--text-${role.name}`;
  return {
    fontFamily: 'var(--font-display)',
    fontSize: `var(${token})`,
    lineHeight: `var(${token}--line-height)`,
    fontWeight: `var(${token}--font-weight)`,
    letterSpacing: `var(${token}--letter-spacing)`,
  };
}

export default function TypographyGuide() {
  return (
    <>
      <p className="brand-section-note">
        Atkinson Hyperlegible Next carries the reading, from a brief opening
        statement to a long article. I use Mono selectively for compact
        metadata, captions, and code. The type roles set hierarchy and purpose;
        a label token doesn’t require Mono.
      </p>

      <section className="brand-type-section" aria-labelledby="type-compose">
        <h3 id="type-compose" className="brand-subheading">
          How I compose a page
        </h3>
        <p className="brand-type-guidance">
          Start with the content’s place in the page. Use a headline for a
          reading page title, then an optional body-large subtitle that adds
          context instead of repeating it. Body medium carries paragraphs;
          headline small marks sections. A display is for a short, prominent
          opening. Titles name smaller pieces, and labels name actions or
          categories. The HTML heading level still follows the document’s
          outline: a display can be an <code>h1</code>, while a headline can be
          an <code>h2</code> or <code>h3</code>.
        </p>

        <div className="brand-type-layouts">
          <figure className="brand-type-layout brand-type-reading">
            <figcaption>Reading page</figcaption>
            <article>
              <p className="brand-type-eyebrow font-mono">
                FIELD NOTES · SEPTEMBER 2026
              </p>
              <h4 className="text-headline-large">
                A city that moves together
              </h4>
              <p className="brand-type-annotation">
                Subtitle, when it helps · body large
              </p>
              <p className="text-body-large brand-type-subtitle">
                What a week without driving can teach us about the trips we all
                make.
              </p>
              <p className="text-body-medium">
                Every trip tells us something about the city around us. The
                details matter most when we listen to the people making them.
              </p>
              <h5 className="text-headline-small">What we noticed</h5>
              <p className="text-body-medium">
                A useful story gives each idea room to breathe and a clear place
                in the whole.
              </p>
            </article>
          </figure>

          <figure className="brand-type-layout brand-type-landing">
            <figcaption>Prominent introduction</figcaption>
            <div>
              <p className="brand-type-eyebrow font-mono">
                WILLIE CHALMERS III
              </p>
              <h4 className="text-display-small desktop:text-display-medium">
                I build software and systems for people.
              </h4>
              <p className="text-body-large">
                Across products and public life, I make complicated things
                easier to use.
              </p>
              <span className="brand-type-action text-label-large">
                Explore the work <span aria-hidden="true">↗</span>
              </span>
            </div>
          </figure>

          <figure className="brand-type-layout brand-type-local">
            <figcaption>Local content and controls</figcaption>
            <div className="brand-type-local-card">
              <p className="text-label-medium brand-type-category">PROJECT</p>
              <h4 className="text-title-large">A better way home</h4>
              <p className="text-body-medium">
                A practical idea, explained in one or two sentences.
              </p>
              <span className="brand-type-action text-label-large">
                See the project <span aria-hidden="true">↗</span>
              </span>
            </div>
            <p className="brand-type-local-note">
              The title belongs to this card. Its category and action are
              labels; both stay in the reading face here.
            </p>
          </figure>
        </div>
      </section>

      <section className="brand-type-section" aria-labelledby="type-faces">
        <h3 id="type-faces" className="brand-subheading">
          The two faces
        </h3>
        <div className="brand-type-faces">
          <div className="brand-type-face">
            <p className="brand-type-face-sample">Atkinson Hyperlegible Next</p>
            <p>Headings, body text, controls, and the wordmark.</p>
            <SiteLink href="https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next">
              Get the font
            </SiteLink>
          </div>
          <div className="brand-type-face">
            <p className="brand-type-face-sample font-mono">
              Atkinson Hyperlegible Mono
            </p>
            <p>Small metadata, captions, and code when it earns its space.</p>
            <SiteLink href="https://fonts.google.com/specimen/Atkinson+Hyperlegible+Mono">
              Get the font
            </SiteLink>
          </div>
        </div>
      </section>

      <section className="brand-type-section" aria-labelledby="type-roles">
        <h3 id="type-roles" className="brand-subheading">
          Type roles
        </h3>
        <p className="brand-type-guidance">
          These are the site’s adapted Material 3 roles, shown at their actual
          sizes. Pick a role by what the text does, then choose the appropriate
          HTML element. Keep body small to short notes because its line height
          is tight; use body medium for sustained reading.
        </p>
        <div className="brand-type-groups">
          {typeFamilies.map((family) => (
            <div className="brand-type-group" key={family.name}>
              <div className="brand-type-group-heading">
                <h4>{family.name}</h4>
                <p>{family.description}</p>
              </div>
              <div className="brand-type-role-list">
                {typeScale
                  .filter((role) =>
                    role.name.startsWith(family.name.toLowerCase())
                  )
                  .map((role) => (
                    <div
                      className="brand-type-role"
                      data-type-role={role.name}
                      key={role.name}
                    >
                      <div className="brand-type-role-description">
                        <h5>{role.name.replace('-', ' ')}</h5>
                        <p>{role.use}</p>
                        <code>text-{role.name}</code>
                      </div>
                      <div className="brand-type-role-preview">
                        <p
                          className="brand-role-sample"
                          style={roleStyle(role)}
                        >
                          {role.sample}
                        </p>
                        <p className="brand-type-role-spec">
                          {role.size}px / {role.lineHeight}px · {role.weight} ·{' '}
                          {role.letterSpacing} tracking
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
