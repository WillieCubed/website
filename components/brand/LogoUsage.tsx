import Image from 'next/image';

import ClearSpace from '@/components/brand/ClearSpace';
import { AssetDownloads, Downloads } from '@/components/brand/Downloads.tsx';
import Icon from '@/components/icons/Icon';

import { type KitUsage, kit } from '@/lib/brand/kit';

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
interface AvoidExampleProps {
  id: string;
}

function AvoidExample({ id }: AvoidExampleProps) {
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
 * Clear space, minimum sizes, which asset to use, and what to avoid. The
 * generated kit supplies both this section and the downloadable guidelines,
 * so the page and the rules agents read use the same measurements.
 */
export function LogoUsage() {
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

      <LogoClearSpace />
      <LogoMinimumSizes />
      <LogoVersionSelection />
      <LogoMistakes />
      <LogoGuidelines />
    </section>
  );
}

function LogoClearSpace() {
  const tile = kitEntry('williecubed-mark');
  const cube = kitEntry('williecubed-cube-on-light');
  const lockup = kitEntry('williecubed-lockup-ink');
  return (
    <section className="brand-rule" aria-labelledby="clear-space">
      <h4 id="clear-space">Clear space</h4>
      <p>
        The cube needs room around it. I call that room <em>x</em>: a quarter of
        the cube’s height, the same gap that sits between the cube and my name.
        Every file ends where its drawing ends, so leave <em>x</em> clear
        outside the file on every side.
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
  );
}

function LogoMinimumSizes() {
  const { usage } = kit;
  const tile = kit.marks.find((mark) => mark.name === 'williecubed-mark');
  if (!tile) throw new Error('The brand kit has no williecubed-mark');
  const smallMarks = kit.marks.filter((mark) => mark.small);
  const small16 = tile.small?.downloads.find((file) => file.label === 'PNG 16');
  return (
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
  );
}

function LogoVersionSelection() {
  const { usage } = kit;
  return (
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
  );
}

function LogoMistakes() {
  const { usage } = kit;
  return (
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
  );
}

function LogoGuidelines() {
  const { usage } = kit;
  return (
    <section className="brand-rule" aria-labelledby="for-agents">
      <h4 id="for-agents">For tools and agents</h4>
      <p>
        The same rules, with every file’s measurements, as structured data and
        as plain text.
      </p>
      <Downloads files={usage.guidelines} showSize />
    </section>
  );
}
