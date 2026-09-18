import {
  Hct,
  SchemeFidelity,
  argbFromHex,
  hexFromArgb,
} from '@material/material-color-utilities';

import { site } from '@/lib/site';

export interface EntityImageProps {
  /** One line of context above the title, such as the parent or the part. */
  kicker?: string;
  title: string;
  description?: string;
  meta?: string;
  /** `#rrggbb` seed; without it the image uses the site palette. */
  brand?: string;
  /** A data URI or absolute URL Satori can fetch. */
  cover?: string;
}

const NEUTRAL = {
  background: '#f4f5ef',
  panel: '#fbfcf9',
  ink: '#1c231e',
  muted: '#69736b',
  accent: '#2f6f5e',
  line: '#dfe3da',
};

function palette(brand?: string) {
  if (!brand || !/^#[0-9a-fA-F]{6}$/.test(brand)) return NEUTRAL;
  const s = new SchemeFidelity(Hct.fromInt(argbFromHex(brand)), false, 0);
  return {
    background: hexFromArgb(s.primaryContainer),
    panel: hexFromArgb(s.surfaceContainerLowest),
    ink: hexFromArgb(s.onSurface),
    muted: hexFromArgb(s.onSurfaceVariant),
    accent: hexFromArgb(s.primary),
    line: hexFromArgb(s.outlineVariant),
  };
}

/**
 * The 1200×630 social card every entity page shares. Satori only knows
 * flexbox and inline styles, hence the shape of this markup.
 */
export default function EntityImage({
  kicker,
  title,
  description,
  meta,
  brand,
  cover,
}: EntityImageProps) {
  const c = palette(brand);
  const titleSize = title.length > 40 ? 56 : title.length > 24 ? 68 : 80;
  return (
    <div
      style={{
        width: 1200,
        height: 630,
        display: 'flex',
        background: c.background,
        color: c.ink,
        fontFamily: 'Atkinson',
        padding: 56,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          background: c.panel,
          borderRadius: 40,
          border: `2px solid ${c.line}`,
          padding: 56,
        }}
      >
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}
        >
          {kicker && (
            <div
              style={{
                display: 'flex',
                fontSize: 26,
                color: c.accent,
                fontWeight: 700,
              }}
            >
              {kicker}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              fontSize: titleSize,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: cover ? 620 : 1000,
            }}
          >
            {title}
          </div>
          {description && (
            <div
              style={{
                display: 'flex',
                fontSize: 30,
                lineHeight: 1.3,
                color: c.muted,
                maxWidth: cover ? 620 : 960,
                overflow: 'hidden',
              }}
            >
              {description.length > 150
                ? `${description.slice(0, 147)}…`
                : description}
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            fontSize: 26,
            color: c.muted,
          }}
        >
          <div style={{ display: 'flex' }}>{meta ?? ''}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                width: 18,
                height: 18,
                borderRadius: 9,
                background: c.accent,
              }}
            />
            <div style={{ display: 'flex', fontWeight: 700, color: c.ink }}>
              {site.name}
            </div>
            <div style={{ display: 'flex' }}>{new URL(site.origin).host}</div>
          </div>
        </div>
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            width={360}
            height={360}
            style={{
              position: 'absolute',
              right: 56,
              top: 56,
              width: 360,
              height: 360,
              borderRadius: 32,
              objectFit: 'cover',
            }}
          />
        )}
      </div>
    </div>
  );
}
