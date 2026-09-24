import Image from 'next/image';
import type { CSSProperties } from 'react';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import JsonLd from '@/components/seo/JsonLd';
import Popover from '@/components/site/Popover';
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

import CopyHex from './CopyHex';
import SectionPicker from './SectionPicker';
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
function Download({
  file,
  showSize = false,
  label,
}: {
  file: KitDownload;
  showSize?: boolean;
  label?: string;
}) {
  return (
    <a href={file.href} download>
      {label ?? file.label}
      {showSize && (
        <span className="brand-size">{formatBytes(file.bytes)}</span>
      )}
    </a>
  );
}

function Downloads({
  files,
  showSize = false,
}: {
  files: KitDownload[];
  showSize?: boolean;
}) {
  return (
    <p className="brand-downloads">
      {files.map((file) => (
        <Download key={file.href} file={file} showSize={showSize} />
      ))}
    </p>
  );
}

function AssetDownloads({ files }: { files: KitDownload[] }) {
  const svg = files.find((file) => file.label === 'SVG');
  const png =
    files.find((file) => file.label === 'PNG 1024') ??
    files.find((file) => file.label === 'PNG');
  const primary = [svg, png].filter((file): file is KitDownload =>
    Boolean(file)
  );
  const other = files.filter((file) => !primary.includes(file));
  return (
    <div className="brand-asset-downloads">
      <p className="brand-downloads">
        {primary.map((file) => (
          <Download
            key={file.href}
            file={file}
            label={`Download ${file === svg ? 'SVG' : 'PNG'}`}
          />
        ))}
      </p>
      {other.length > 0 && (
        <Popover
          label="More formats"
          trigger={<Icon name="more-horizontal" size={18} />}
          triggerClassName="brand-more-formats"
          panelClassName="brand-picker-panel"
          align="end"
        >
          {other.map((file) => (
            <Download key={file.href} file={file} />
          ))}
        </Popover>
      )}
    </div>
  );
}

function PlatformGuidance({ title }: { title: string }) {
  if (title === 'Web and PWA') {
    return (
      <div className="brand-platform-guide">
        <p>
          Use <code>favicon.svg</code> for browser tabs and{' '}
          <code>apple-touch-icon.png</code> for saved Home Screen shortcuts.
        </p>
        <p>
          For an installable site, the manifest lists the icon sizes and
          maskable versions. Update its name, URLs, and icon paths for the
          project using it.
        </p>
      </div>
    );
  }
  if (title === 'Apple platforms') {
    return (
      <div className="brand-platform-guide">
        <p>
          Open the kit’s complete <code>apple/WillieCubed.icon</code> package in
          Icon Composer, or add it to Xcode 26. Keep its <code>Assets</code>{' '}
          folder with it; <code>icon.json</code> alone does not contain the
          artwork.
        </p>
        <p>
          The kit also includes a macOS <code>.icns</code> file and a flat{' '}
          <code>AppIcon.appiconset</code> for older Xcode projects.
        </p>
        <SiteLink href="https://developer.apple.com/documentation/xcode/creating-your-app-icon-using-icon-composer">
          Apple’s setup guide
        </SiteLink>
      </div>
    );
  }
  return (
    <div className="brand-platform-guide">
      <p>
        Use <code>android/res/</code> as a set. Its foreground, background, and
        monochrome layers let the launcher apply its shape and theme. The PNG
        sizes support older devices.
      </p>
      <p>
        <code>play-store-512.png</code> is for the store listing. Use the
        layered resources for the app’s launcher icon.
      </p>
      <SiteLink href="https://developer.android.com/develop/ui/views/launch/icon_design_adaptive">
        Android’s adaptive icon guide
      </SiteLink>
    </div>
  );
}

function PlatformFiles({ title }: { title: string }) {
  const group = kit.platforms.find((entry) => entry.title === title);
  if (!group) return null;
  return (
    <div className="brand-platform">
      <details>
        <summary aria-label={`${title}: browse files`}>
          {title}: files and setup
        </summary>
        <h4>{title}</h4>
        <PlatformGuidance title={title} />
        <ul className="brand-files">
          {group.files.map((file) => (
            <li key={file.href}>
              <a href={file.href} download>
                <code>{file.name}</code>
                <span className="brand-size">{formatBytes(file.bytes)}</span>
              </a>
              <span className="brand-purpose">{file.purpose}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

const INTRO =
  'Here’s the cube, the colors, and the type I use across my projects.';

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
      <div className="brand-header">
        <TopBar
          crumbs={[
            { label: 'Brand', href: '/brand', control: <SectionPicker /> },
          ]}
        />
      </div>
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
            <p>{INTRO}</p>
            <Downloads files={[kit.archive]} showSize />
          </div>
        </section>

        <section className="brand-chapter" aria-labelledby="mark">
          <h2 id="mark" tabIndex={-1}>
            Logo
          </h2>
          <p className="brand-section-note">
            It’s a little cheesy, but the cube represents me: one whole with
            multiple sides. I use it as a calling card for my projects and
            wherever I need a single graphic to represent myself.
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
                  <h3>{mark.label === 'Mark' ? 'The cube' : mark.label}</h3>
                  <p>{mark.note}</p>
                  <AssetDownloads files={mark.downloads} />
                </figcaption>
              </figure>
            ))}
          </div>
          <section aria-labelledby="usage">
            <h3 id="usage" className="brand-subheading">
              Size and clear space
            </h3>
            <p className="brand-section-note">
              The cube needs a little space to itself. The gap between its faces
              is also the minimum space I leave around it. At tiny sizes, I use
              a version with wider gaps so the faces don’t run together.
            </p>
            <div className="brand-usage-layout">
              <figure className="brand-clear-space">
                <svg
                  viewBox="0 0 260 220"
                  role="img"
                  aria-labelledby="clear-space-title clear-space-description"
                >
                  <title id="clear-space-title">
                    Clear space around the mark
                  </title>
                  <desc id="clear-space-description">
                    The dashed boundary leaves one facet gap on every side of
                    the mark. The same gap is highlighted between the two lower
                    facets.
                  </desc>
                  {/* The master uses radius 204 and gap 0.118 × radius on a 512 canvas. At 160px the gap is 7.52px. */}
                  <rect
                    x="42.48"
                    y="12.48"
                    width="175.04"
                    height="175.04"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray="3 3"
                  />
                  <image
                    href="/brand/mark/williecubed-mark.svg"
                    x="50"
                    y="20"
                    width="160"
                    height="160"
                  />
                  <path
                    d="M126.24 119h7.52m-7.52 -3v6m7.52 -6v6M130 180v7.52m-3 -7.52h6m-6 7.52h6M130 187.52v12"
                    fill="none"
                    stroke="currentColor"
                  />
                  <text
                    x="130"
                    y="215"
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize="12"
                  >
                    One facet gap on each side
                  </text>
                </svg>
                <figcaption>Keep this space clear.</figcaption>
              </figure>
              <div>
                <div className="brand-small-marks">
                  {[16, 32].map((size) => (
                    <figure key={size}>
                      <Image
                        src={
                          size < 32
                            ? '/brand/web/favicon.svg'
                            : '/brand/mark/williecubed-mark.svg'
                        }
                        alt={`Tiled mark at ${size}px`}
                        width={size}
                        height={size}
                      />
                      <figcaption>{size}px</figcaption>
                    </figure>
                  ))}
                </div>
                <ul className="brand-usage">
                  <li>
                    Keep clear space around the mark equal to one facet gap at
                    the size you use it.
                  </li>
                  <li>
                    Use the tiled mark below 32px; the facet gaps are widened
                    for small sizes.
                  </li>
                  <li>
                    Don’t recolor, rotate, stretch, or add effects to the cube
                    elsewhere. The footer alone shifts between monochrome and
                    the existing full-color mark on hover, focus, or activation.
                  </li>
                  <li>
                    Use the one-color versions only where color reproduction
                    isn’t available.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <section aria-labelledby="lockups">
            <h3 id="lockups" className="brand-subheading">
              Logo with my name
            </h3>
            <p className="brand-section-note">
              The cube won’t tell everyone who I am on its own. These versions
              put my name beside it, with the spacing already worked out. Use
              one when you’re introducing me rather than just identifying one of
              my projects.
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
                    className="brand-preview"
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
                    <AssetDownloads files={lockup.downloads} />
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        </section>

        <section className="brand-chapter" aria-labelledby="color">
          <h2 id="color" tabIndex={-1}>
            Colors
          </h2>
          <p className="brand-section-note">
            I use the same palette for the cube and this site. The paper color
            becomes its top face, the text color becomes its shaded face, and
            mint fills the third. Even the almost-black and almost-white have a
            little green in them. The logo doesn’t need a separate set of colors
            to feel at home here.
          </p>
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
                    <CopyHex name={color.name} value={color.hex} />
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
          <h2 id="type" tabIndex={-1}>
            Typography
          </h2>
          <p className="brand-section-note">
            I use Atkinson Hyperlegible Next for my name and the longer things I
            write. For labels, captions, and code, I switch to Atkinson
            Hyperlegible Mono. That keeps the small details distinct while
            keeping both fonts in the same family.
          </p>
          <div className="brand-type-example">
            <p className="brand-type-heading">Willie Chalmers III</p>
            <p>{INTRO}</p>
            <p className="brand-type-caption font-mono">
              Willie Chalmers III · willie.page
            </p>
          </div>
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

        <section className="brand-chapter" aria-labelledby="in-use">
          <h2 id="in-use" tabIndex={-1}>
            Applications
          </h2>
          <p className="brand-section-note">
            I use the cube as a calling card, but I can’t give every platform
            the exact same file. A browser tab has a few pixels to work with; an
            app icon has room for a different treatment.
          </p>
          <section aria-labelledby="browser-icons" id="platforms">
            <h3 id="browser-icons" className="brand-subheading">
              Browser and Home Screen
            </h3>
            <p className="brand-section-note">
              I widen the gaps between the faces for the browser icon so you can
              still make out the cube at 16px. If you save the site to your Home
              Screen, your device uses one of the larger versions.
            </p>
            <div className="brand-browser-example">
              <Image
                src="/brand/web/favicon.svg"
                alt=""
                width={16}
                height={16}
              />
              <span>Willie Chalmers III</span>
              <span aria-hidden="true">×</span>
            </div>
            <PlatformFiles title="Web and PWA" />
          </section>
          <section aria-labelledby="social">
            <h3 id="social" className="brand-subheading">
              Social profiles and link previews
            </h3>
            <p className="brand-section-note">
              I use the avatar across my profiles. For shared links, I include
              my name and what I do in the preview. You shouldn’t have to
              recognize the cube to know whose site you’re opening.
            </p>
            <div className="brand-grid brand-grid-wide">
              {[
                {
                  title: 'Avatar',
                  preview: 'avatar-1024.png',
                  width: 1024,
                  height: 1024,
                  prefix: 'avatar-',
                },
                {
                  title: 'Link preview',
                  preview: 'og-image.svg',
                  width: 1200,
                  height: 630,
                  prefix: 'og-image.',
                },
              ].map((asset) => (
                <figure className="brand-asset" key={asset.title}>
                  <div
                    className={`brand-preview brand-social-preview ${asset.prefix === 'avatar-' ? 'brand-avatar-preview' : ''}`}
                  >
                    <Image
                      src={`/brand/social/${asset.preview}`}
                      alt={`WillieCubed ${asset.title.toLowerCase()}`}
                      width={asset.width}
                      height={asset.height}
                      sizes={
                        asset.prefix === 'avatar-'
                          ? '160px'
                          : '(min-width: 1200px) 516px, (min-width: 600px) 80vw, 90vw'
                      }
                    />
                  </div>
                  <figcaption>
                    <h3>{asset.title}</h3>
                    <Downloads
                      files={(
                        kit.platforms.find((group) => group.title === 'Social')
                          ?.files ?? []
                      )
                        .filter((file) => file.name.startsWith(asset.prefix))
                        .map((file) => ({ ...file, label: file.name }))}
                    />
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          {kit.appIcons.length > 0 && (
            <section aria-labelledby="app-icon">
              <h3 id="app-icon" className="brand-subheading">
                Apple app icons
              </h3>
              <p className="brand-section-note">
                This is the cube in Liquid Glass. The three faces are separate
                layers in Icon Composer, which lets Apple’s renderer light them
                individually. It gives my otherwise flat logo some depth without
                changing the cube itself. These PNGs are useful for mockups; the
                editable Icon Composer version is in the{' '}
                <a href={kit.archive.href} download>
                  brand kit
                </a>
                .
              </p>
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
                        width={1024}
                        height={1024}
                        sizes="160px"
                        quality={90}
                        className="brand-app-icon"
                      />
                    </div>
                    <figcaption>
                      <h3>{capitalize(icon.appearance)}</h3>
                      <Downloads files={icon.downloads} />
                    </figcaption>
                  </figure>
                ))}
              </div>
              <PlatformFiles title="Apple platforms" />
            </section>
          )}

          <section aria-labelledby="android-icons">
            <h3 id="android-icons" className="brand-subheading">
              Android app icons
            </h3>
            <p className="brand-section-note">
              On Android, I don’t get to pick the final outline. Your launcher
              might use a circle or a rounded square. The artwork leaves enough
              room around the cube for either crop, and the separate monochrome
              layer lets it follow your phone’s icon theme.
            </p>
            <div className="brand-android-examples">
              <Image
                src="/brand/android/play-store-512.png"
                alt="Cube with a circular launcher crop"
                width={512}
                height={512}
                sizes="120px"
              />
              <Image
                src="/brand/android/play-store-512.png"
                alt="Cube with a rounded-square launcher crop"
                width={512}
                height={512}
                sizes="120px"
              />
            </div>
            <PlatformFiles title="Android" />
          </section>
        </section>
      </main>
    </>
  );
}
