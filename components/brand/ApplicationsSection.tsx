import Image from 'next/image';
import type { CSSProperties } from 'react';

import {
  Downloads,
  PlatformFiles,
  capitalize,
} from '@/components/brand/Downloads.tsx';

import { iosIconMask, kit } from '@/lib/brand/kit';

export default function ApplicationsSection() {
  return (
    <section className="brand-chapter" aria-labelledby="in-use">
      <h2 id="in-use" tabIndex={-1}>
        Applications
      </h2>
      <p className="brand-section-note">
        I use the cube as a calling card, but I can’t give every platform the
        exact same file. A browser tab has a few pixels to work with; an app
        icon has room for a different treatment.
      </p>
      <BrowserApplications />
      <SocialApplications />
      <AppleAppIcons />
      <AndroidAppIcons />
    </section>
  );
}

function BrowserApplications() {
  return (
    <section aria-labelledby="browser-icons" id="platforms">
      <h3 id="browser-icons" className="brand-subheading">
        Browser and Home Screen
      </h3>
      <p className="brand-section-note">
        I widen the gaps between the faces for the browser icon so you can still
        make out the cube at 16px. If you save the site to your Home Screen,
        your device uses one of the larger versions.
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
  );
}

function SocialApplications() {
  return (
    <section aria-labelledby="social">
      <h3 id="social" className="brand-subheading">
        Social profiles and link previews
      </h3>
      <p className="brand-section-note">
        I use the avatar across my profiles. For shared links, I include my name
        and what I do in the preview. You shouldn’t have to recognize the cube
        to know whose site you’re opening.
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
  );
}

function AppleAppIcons() {
  if (kit.appIcons.length === 0) return null;
  return (
    <section aria-labelledby="app-icon">
      <h3 id="app-icon" className="brand-subheading">
        Apple app icons
      </h3>
      <p className="brand-section-note">
        This is the cube in Liquid Glass. The three faces are separate layers in
        Icon Composer, which lets Apple’s renderer light them individually. It
        gives my otherwise flat logo some depth without changing the cube
        itself. These PNGs are useful for mockups; the editable Icon Composer
        version is in the{' '}
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
  );
}

function AndroidAppIcons() {
  return (
    <section aria-labelledby="android-icons">
      <h3 id="android-icons" className="brand-subheading">
        Android app icons
      </h3>
      <p className="brand-section-note">
        On Android, I don’t get to pick the final outline. Your launcher might
        use a circle or a rounded square. The artwork leaves enough room around
        the cube for either crop, and the separate monochrome layer lets it
        follow your phone’s icon theme.
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
  );
}
