import Image from 'next/image';
import type { CSSProperties } from 'react';

import SiteLink from '@/components/link/SiteLink';
import JsonLd from '@/components/seo/JsonLd';
import TopBar from '@/components/site/TopBar';

import {
  type KitDownload,
  formatBytes,
  iosIconMask,
  kit,
  kitColor,
} from '@/lib/brand/kit';
import { graph, personLd, webPageLd, websiteLd } from '@/lib/seo/jsonld';
import { pageMetadata } from '@/lib/site';

import './brand.css';

const BRAND = {
  title: 'Brand',
  description:
    'Download the WillieCubed mark, lockups, app icons, and color and type tokens.',
  path: '/brand',
};

export const metadata = pageMetadata(BRAND);

/**
 * A kit file. These are files, not pages, so they stay plain anchors, like
 * the feed links in the footer: a SiteLink would prefetch each one as a
 * route and look it up for a hover card it cannot have.
 */
function Download({ file }: { file: KitDownload }) {
  return (
    <a href={file.href} download>
      {file.label}
      <span className="brand-size">{formatBytes(file.bytes)}</span>
    </a>
  );
}

function Downloads({ files }: { files: KitDownload[] }) {
  return (
    <p className="brand-downloads">
      {files.map((file) => (
        <Download key={file.href} file={file} />
      ))}
    </p>
  );
}

/** Asset previews keep the kit's own paper and ink in either scheme. */
const PREVIEW_SURFACES = {
  '--brand-paper': kitColor('paper'),
  '--brand-ink': kitColor('ink'),
} as CSSProperties;

const capitalize = (word: string) => word[0].toUpperCase() + word.slice(1);

export default function BrandPage() {
  return (
    <>
      <JsonLd
        data={graph(
          webPageLd({
            name: BRAND.title,
            description: BRAND.description,
            path: BRAND.path,
          }),
          websiteLd(),
          personLd()
        )}
      />
      <TopBar crumbs={[{ label: 'Brand', href: '/brand' }]} />
      <main
        id="main"
        className="brand-page mx-auto max-w-[1200px] px-5 pb-20"
        style={PREVIEW_SURFACES}
      >
        <section className="brand-intro" aria-labelledby="brand-title">
          <Image
            src="/brand/mark/williecubed-mark.svg"
            alt=""
            width={96}
            height={96}
            loading="eager"
          />
          <div>
            <h1 id="brand-title" className="text-display-small text-ink">
              WillieCubed brand
            </h1>
            <p>Marks, lockups, app icons, colors, and type.</p>
            <Downloads files={[kit.archive]} />
          </div>
        </section>

        <section aria-labelledby="mark">
          <h2 id="mark">Mark</h2>
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
                  <Downloads files={mark.downloads} />
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section aria-labelledby="lockups">
          <h2 id="lockups">Wordmark and lockups</h2>
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
                  className="brand-preview"
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
                  <Downloads files={lockup.downloads} />
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section aria-labelledby="color">
          <h2 id="color">Color</h2>
          <ul className="brand-swatches">
            {kit.colors.map((color) => (
              <li key={color.key} className="brand-swatch">
                <span
                  className="brand-chip"
                  style={{ backgroundColor: color.hex }}
                />
                <h3>{color.name}</h3>
                <p>{color.role}</p>
                <dl>
                  <dt>Hex</dt>
                  <dd>
                    <code>{color.hex}</code>
                  </dd>
                  <dt>RGB</dt>
                  <dd>
                    <code>{color.rgb}</code>
                  </dd>
                  <dt>OKLCH</dt>
                  <dd>
                    <code>{color.oklch}</code>
                  </dd>
                </dl>
              </li>
            ))}
          </ul>
          <Downloads files={kit.tokens} />
        </section>

        <section aria-labelledby="type">
          <h2 id="type">Typography</h2>
          <div className="brand-specimens">
            <div className="brand-specimen">
              <p className="brand-specimen-sample font-sans">
                Atkinson Hyperlegible Next
              </p>
              <p>
                Headlines, body text, and the wordmark. Designed by the Braille
                Institute for legibility.
              </p>
              <p className="brand-downloads">
                <SiteLink href="https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next">
                  Google Fonts
                </SiteLink>
              </p>
            </div>
            <div className="brand-specimen">
              <p className="brand-specimen-sample brand-specimen-mono font-mono">
                Atkinson Hyperlegible Mono
              </p>
              <p>Labels, captions, and code.</p>
              <p className="brand-downloads">
                <SiteLink href="https://fonts.google.com/specimen/Atkinson+Hyperlegible+Mono">
                  Google Fonts
                </SiteLink>
              </p>
            </div>
          </div>
        </section>

        {kit.appIcons.length > 0 && (
          <section aria-labelledby="app-icon">
            <h2 id="app-icon">App icon</h2>
            {/* The renders are opaque squares because iOS applies its own
                mask. The previews borrow that outline so the glass rim
                shows whole; the downloads stay unmasked. */}
            <div
              className="brand-grid"
              style={{ '--ios-mask': iosIconMask() } as CSSProperties}
            >
              {kit.appIcons.map((icon) => (
                <figure
                  key={icon.preview}
                  className="brand-asset"
                  data-dark={icon.appearance !== 'default' || undefined}
                >
                  <div className="brand-preview">
                    <Image
                      src={icon.preview}
                      alt={`WillieCubed app icon, ${icon.appearance} appearance`}
                      width={160}
                      height={160}
                      className="brand-app-icon"
                    />
                  </div>
                  <figcaption>
                    <h3>{capitalize(icon.appearance)}</h3>
                    <p>
                      Liquid Glass, rendered by Xcode from the Icon Composer
                      document.
                    </p>
                    <Downloads files={icon.downloads} />
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="platforms">
          <h2 id="platforms">Platform icons</h2>
          <div className="brand-file-groups">
            {kit.platforms.map((group) => (
              <div key={group.title}>
                <h3>{group.title}</h3>
                <ul className="brand-files">
                  {group.files.map((file) => (
                    <li key={file.href}>
                      <a href={file.href} download>
                        <code>{file.name}</code>
                        <span className="brand-size">
                          {formatBytes(file.bytes)}
                        </span>
                      </a>
                      <span className="brand-purpose">{file.purpose}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="usage">
          <h2 id="usage">Usage</h2>
          <ul className="brand-usage">
            <li>
              Keep clear space around the mark equal to one facet gap at the
              size you use it.
            </li>
            <li>
              Use the tiled mark below 32px; the facet gaps are widened for
              small sizes.
            </li>
            <li>Don’t recolor, rotate, stretch, or add effects to the cube.</li>
            <li>
              Use the one-color versions only where color reproduction isn’t
              available.
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}
