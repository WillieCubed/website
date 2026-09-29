import Image from 'next/image';
import type { CSSProperties } from 'react';

import Icon from '@/components/icons/Icon';
import SiteLink from '@/components/link/SiteLink';
import JsonLd from '@/components/seo/JsonLd';
import type { BreadcrumbMenuItem } from '@/components/site/BreadcrumbMenu';
import Popover from '@/components/site/Popover';
import TopBar from '@/components/site/TopBar';

import {
  type KitDownload,
  type KitUsage,
  formatBytes,
  iosIconMask,
  kit,
  kitColor,
} from '@/lib/brand/kit';
import { graph, personLd, webPageLd, websiteLd } from '@/lib/seo/jsonld';
import { pageMetadata, sitePage } from '@/lib/site';

import ClearSpace from './ClearSpace';
import CopyHex from './CopyHex';
import TypographyGuide from './TypographyGuide';
import './brand.css';

const BRAND_PAGE = sitePage('/brand');
const BRAND = {
  title: BRAND_PAGE.label,
  description: BRAND_PAGE.description,
  path: BRAND_PAGE.path,
};

const BRAND_SECTIONS: BreadcrumbMenuItem[] = [
  { label: 'Logo', href: '#mark' },
  { label: 'Colors', href: '#color' },
  { label: 'Typography', href: '#type' },
  { label: 'Applications', href: '#in-use' },
];

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
  shortLabel,
}: {
  file: KitDownload;
  showSize?: boolean;
  label?: string;
  shortLabel?: string;
}) {
  return (
    <a href={file.href} download aria-label={shortLabel ? label : undefined}>
      {shortLabel ? (
        <>
          <span className="brand-download-label-full">{label}</span>
          <span className="brand-download-label-short">{shortLabel}</span>
        </>
      ) : (
        (label ?? file.label)
      )}
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

function AssetDownloads({
  files,
  png: pngLabel = 'PNG 1024',
}: {
  files: KitDownload[];
  /** The PNG offered beside the SVG; the rest wait under More formats. */
  png?: string;
}) {
  const svg = files.find((file) => file.label === 'SVG');
  const png =
    files.find((file) => file.label === pngLabel) ??
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
            shortLabel={file === svg ? 'SVG' : 'PNG'}
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
  '--brand-green': kitColor('green'),
} as CSSProperties;

const capitalize = (word: string) => word[0].toUpperCase() + word.slice(1);

/** A mark or lockup by its file name; the rules below name files, not cards. */
function kitEntry(name: string) {
  const entry = [...kit.marks, ...kit.lockups].find((e) => e.name === name);
  if (!entry) throw new Error(`The brand kit has no ${name}`);
  return entry;
}

const percent = (share: number) => `${Math.round(share * 1000) / 10}%`;

const SIZE_GROUPS: Array<{ label: string; kind: KitUsage['kind'] }> = [
  { label: 'Cube with the tile', kind: 'tile' },
  { label: 'Cube without the tile', kind: 'cube' },
  { label: 'Lockups', kind: 'lockup' },
  { label: 'Wordmark', kind: 'wordmark' },
];

const TILE = '/brand/mark/williecubed-mark.svg';

/** The real mark, changed the one way each rule forbids. */
function AvoidExample({ id }: { id: string }) {
  switch (id) {
    case 'crowd':
      return (
        <span className="brand-avoid-crowd">
          <Image src={TILE} alt="" aria-hidden="true" width={56} height={56} />
          <span>Launch day</span>
        </span>
      );
    case 'too-small':
      return (
        <Image
          src={kit.usage.guide.regular16}
          alt=""
          aria-hidden="true"
          width={16}
          height={16}
          unoptimized
          className="brand-magnified"
        />
      );
    case 'rebuild':
      return (
        <span className="brand-avoid-rebuild">
          <Image
            src="/brand/mark/williecubed-cube-on-light.svg"
            alt=""
            aria-hidden="true"
            width={30}
            height={32}
          />
          <span>williecubed</span>
        </span>
      );
    default:
      return (
        <Image
          src={TILE}
          alt=""
          aria-hidden="true"
          width={72}
          height={72}
          className={`brand-avoid-${id}`}
        />
      );
  }
}

/**
 * Clear space, minimum sizes, which file to use, and what not to do. Every
 * number comes from kit.json, which also writes guidelines.json and
 * guidelines.md, so this section and the files agents read can't disagree.
 */
function LogoUsage() {
  const { usage } = kit;
  const tile = kit.marks.find((mark) => mark.name === 'williecubed-mark');
  if (!tile) throw new Error('The brand kit has no williecubed-mark');
  const cube = kitEntry('williecubed-cube-on-light');
  const lockup = kitEntry('williecubed-lockup-ink');
  const smallMarks = kit.marks.filter((mark) => mark.small);
  const small16 = tile.small?.downloads.find((f) => f.label === 'PNG 16');

  return (
    <section aria-labelledby="usage">
      <h3 id="usage" className="brand-subheading">
        Using the logo
      </h3>
      <p className="brand-section-note">
        Anyone making something with my logo, a person or an agent working for
        me, follows the same few rules. The numbers come straight from the
        files, and the rules are also available below as JSON and Markdown.
      </p>

      <section className="brand-rule" aria-labelledby="clear-space">
        <h4 id="clear-space">Clear space</h4>
        <p>
          The cube needs room around it. I call that room <em>x</em>: a quarter
          of the cube’s height, the same gap that sits between the cube and my
          name. Every file ends where its drawing ends, so leave <em>x</em>{' '}
          clear outside the file on every side.
        </p>
        <div className="brand-clear-space-grid">
          {[
            {
              entry: tile,
              title: 'With the tile',
              rule: `x is ${percent(tile.usage.clearSpace?.ofWidth ?? 0)} of the tile’s width.`,
            },
            {
              entry: cube,
              title: 'Without the tile',
              rule: `x is ${percent(cube.usage.clearSpace?.ofHeight ?? 0)} of the file’s height.`,
            },
            {
              entry: lockup,
              title: 'Lockups',
              rule: `x is the gap between the cube and the name, ${percent(lockup.usage.clearSpace?.ofHeight ?? 0)} of the file’s height.`,
              gap: true,
            },
          ].map(({ entry, title, rule, gap }) => (
            <figure
              key={entry.name}
              className={`brand-asset${gap ? ' brand-clear-space-wide' : ''}`}
            >
              {/* The lockup keeps a readable band by scrolling on a phone,
                so its preview takes focus like the lockup cards above. */}
              <div
                className={`brand-preview${gap ? ' scroller' : ''}`}
                {...(gap && {
                  tabIndex: 0,
                  role: 'region',
                  'aria-label': `${title} clear space`,
                })}
              >
                <ClearSpace src={entry.preview} usage={entry.usage} gap={gap} />
              </div>
              <figcaption>
                <h5>{title}</h5>
                <p>{rule}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="brand-rule" aria-labelledby="minimum-size">
        <h4 id="minimum-size">Minimum size</h4>
        <p>
          Sizes measure the logo’s height. At {usage.smallMaxPx}px or smaller, I
          switch to a version with wider gaps so the faces don’t blur together.
        </p>
        <dl className="brand-min-sizes">
          {SIZE_GROUPS.map(({ label, kind }) => {
            const min = [...kit.marks, ...kit.lockups].find(
              (entry) => entry.usage.kind === kind
            )?.usage.minSize;
            if (!min) return null;
            const hasSmall = kind === 'tile' || kind === 'cube';
            return (
              <div key={kind}>
                <dt>{label}</dt>
                <dd>
                  <span>On screen</span> {min.px}px
                </dd>
                <dd>
                  <span>In print</span> {min.mm}mm
                </dd>
                <dd className="brand-min-note">
                  {hasSmall
                    ? `Switch to the small version at ${usage.smallMaxPx}px and under.`
                    : 'No small version, so never below the minimum.'}
                </dd>
              </div>
            );
          })}
        </dl>
        {small16 && (
          <div className="brand-small-compare">
            {[
              { src: usage.guide.regular16, label: 'Regular at 16px' },
              { src: small16.href, label: 'Small version at 16px' },
            ].map(({ src, label }) => (
              <figure key={src}>
                <span>
                  <Image
                    src={src}
                    alt=""
                    aria-hidden="true"
                    width={16}
                    height={16}
                    unoptimized
                  />
                  <Image
                    src={src}
                    alt={`${label}, magnified`}
                    width={16}
                    height={16}
                    unoptimized
                    className="brand-magnified"
                  />
                </span>
                <figcaption>{label}</figcaption>
              </figure>
            ))}
          </div>
        )}
        <div className="brand-grid brand-grid-small">
          {smallMarks.map((mark) => (
            <figure
              key={mark.name}
              className="brand-asset"
              data-dark={mark.dark || undefined}
            >
              <div className="brand-preview">
                {[48, 32, 16].map((size) => (
                  <Image
                    key={size}
                    src={mark.small?.preview ?? mark.preview}
                    alt={`${mark.label} at ${size}px`}
                    width={size}
                    height={size}
                    style={{ width: 'auto', height: size }}
                  />
                ))}
              </div>
              <figcaption>
                <h5>{mark.label}, small</h5>
                <AssetDownloads
                  files={mark.small?.downloads ?? []}
                  png="PNG 96"
                />
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="brand-rule" aria-labelledby="choosing">
        <h4 id="choosing">Choosing a version</h4>
        <p>Start at the top and use the first one that fits.</p>
        <ol className="brand-selection">
          {usage.selection.map((choice) => (
            <li key={choice.when}>
              <strong>{choice.when}</strong>
              {choice.use.length > 0 ? (
                <span>
                  {choice.use.map((use, i) => (
                    <span key={use.name}>
                      {i > 0 && ' or '}
                      <a
                        href={
                          kitEntry(use.name).downloads.find(
                            (f) => f.label === 'SVG'
                          )?.href
                        }
                        download
                      >
                        {use.label}
                      </a>
                      {use.background !== 'any' &&
                        !use.label.includes(`on ${use.background}`) &&
                        ` on ${use.background} backgrounds`}
                    </span>
                  ))}
                </span>
              ) : (
                <span>{choice.note}</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="brand-rule" aria-labelledby="avoid">
        <h4 id="avoid">What to avoid</h4>
        <p>
          The files already look the way they should. Most mistakes come from
          changing them.
        </p>
        <ul className="brand-avoid">
          {usage.prohibited.map((item) => (
            <li key={item.id}>
              <div
                className="brand-avoid-preview"
                role="img"
                aria-label={`Incorrect: ${item.rule}`}
              >
                <AvoidExample id={item.id} />
              </div>
              <p>
                <span className="brand-avoid-label">
                  <Icon name="x" size={14} />
                  Avoid
                </span>
                {item.rule} <span>{item.why}</span>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="brand-rule" aria-labelledby="for-agents">
        <h4 id="for-agents">For tools and agents</h4>
        <p>
          The same rules, with every file’s measurements, as structured data and
          as plain text.
        </p>
        <Downloads files={usage.guidelines} showSize />
      </section>
    </section>
  );
}

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
          floating
          crumbs={[
            {
              label: 'Brand',
              href: '/brand',
              menuItems: BRAND_SECTIONS,
            },
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
            aria-hidden="true"
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
          <TypographyGuide />
          <Downloads files={kit.tokens} />
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
                aria-hidden="true"
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
