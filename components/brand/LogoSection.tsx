import Image from 'next/image';
import type { CSSProperties } from 'react';

import { AssetDownloads } from '@/components/brand/Downloads.tsx';
import { LogoUsage } from '@/components/brand/LogoUsage.tsx';

import { kit } from '@/lib/brand/kit';

export default function LogoSection() {
  return (
    <section className="brand-chapter" aria-labelledby="mark">
      <h2 id="mark" tabIndex={-1}>
        Logo
      </h2>
      <p className="brand-section-note">
        It’s a little cheesy, but the cube represents me: one whole with
        multiple sides. I use it as a calling card for my projects and wherever
        I need a single graphic to represent myself.
      </p>
      <div className="brand-grid">
        {kit.marks.map((mark) => (
          <figure
            key={mark.name}
            className="brand-asset"
            data-dark={mark.dark || undefined}
          >
            <div className="brand-preview">
              <Image
                src={mark.preview}
                alt={mark.label}
                width={160}
                height={160}
              />
            </div>
            <figcaption>
              <h3>{mark.label}</h3>
              <p>{mark.note}</p>
              <AssetDownloads files={mark.downloads} />
            </figcaption>
          </figure>
        ))}
      </div>
      <section aria-labelledby="lockups">
        <h3 id="lockups" className="brand-subheading">
          Logo with my name
        </h3>
        <p className="brand-section-note">
          The cube won’t tell everyone who I am on its own. These versions put
          my name beside it, with the spacing already worked out. Use one when
          you’re introducing me rather than just identifying one of my projects.
        </p>
        <div className="brand-grid brand-grid-wide">
          {kit.lockups.map((lockup) => (
            <figure
              key={lockup.name}
              className="brand-asset brand-asset-wide"
              data-dark={lockup.dark || undefined}
            >
              {/* Every lockup shows at one cap height, however wide it
                    runs; a long one scrolls inside its own card. */}
              <div
                className="brand-preview scroller"
                tabIndex={0}
                role="region"
                aria-label={`${lockup.label} preview`}
                style={
                  {
                    '--lockup-ratio': lockup.height / lockup.cap,
                  } as CSSProperties
                }
              >
                <Image
                  src={lockup.preview}
                  alt={lockup.label}
                  width={lockup.width}
                  height={lockup.height}
                />
              </div>
              <figcaption>
                <h3>{lockup.label}</h3>
                <p>{lockup.note}</p>
                <AssetDownloads files={lockup.downloads} />
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <LogoUsage />
    </section>
  );
}
