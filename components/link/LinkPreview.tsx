'use client';

import type { CSSProperties } from 'react';

import type { EntityCard } from '@/lib/entities/types';

const KIND_LABEL: Record<EntityCard['kind'], string> = {
  page: 'Page',
  writing: 'Writing',
  project: 'Project',
  initiative: 'Initiative',
  part: 'Part',
  venture: 'Venture',
  product: 'Product',
};

interface LinkPreviewProps {
  card: EntityCard;
  style: CSSProperties;
  popoverRef: React.Ref<HTMLSpanElement>;
}

/**
 * The card itself. It only repeats what the destination page says about
 * itself, so it is hidden from assistive technology: a screen reader user
 * already has the link text and lands on the same title one step later.
 */
export default function LinkPreview({
  card,
  style,
  popoverRef,
}: LinkPreviewProps) {
  return (
    <span
      ref={popoverRef}
      popover="manual"
      className="link-preview"
      style={style}
      aria-hidden="true"
      data-kind={card.kind}
    >
      {card.cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="link-preview__cover"
          src={card.cover.src}
          alt=""
          loading="lazy"
          decoding="async"
        />
      )}
      <span className="link-preview__body">
        <span className="link-preview__kind">{KIND_LABEL[card.kind]}</span>
        <span className="link-preview__title">{card.title}</span>
        {card.description && (
          <span className="link-preview__desc">{card.description}</span>
        )}
        {card.meta && <span className="link-preview__meta">{card.meta}</span>}
      </span>
    </span>
  );
}
