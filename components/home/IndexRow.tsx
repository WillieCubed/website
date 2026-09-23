'use client';

import type { Venture } from '@/lib/home/ventures';

import { brandStyle, useHome, usePreviewHandlers } from './HomeContext';
import { Icon } from './Icon';

export function IndexRow({ venture }: { venture: Venture }) {
  const { matches, openDetail, brands } = useHome();
  const handlers = usePreviewHandlers({ id: venture.id });
  const style = brandStyle(brands, venture.brand);
  return (
    <li>
      <a
        href={`?detail=${venture.id}`}
        data-id={venture.id}
        data-brand={venture.brand}
        data-branded={style ? '' : undefined}
        style={style}
        className={matches(venture.id) ? 'hit' : undefined}
        {...handlers}
        onClick={(event) => {
          event.preventDefault();
          openDetail(venture.id, event.currentTarget);
        }}
      >
        {/* Decorative: the row's text already names the venture, and the
            detail view it opens describes the same screenshots. */}
        <span className="stack">
          {/* The rail is on the first screen at every size, so these load
              eagerly; the tiles below share the same files. */}
          {venture.stack?.map((image) => (
            <i key={image.src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                width={image.width}
                height={image.height}
                alt=""
                decoding="async"
              />
            </i>
          ))}
        </span>
        <span className="row-text">
          <span className="row-name">{venture.name}</span>
          <span className="row-line">{venture.line}</span>
        </span>
        <span className="go" aria-hidden="true">
          <Icon name="forward" />
        </span>
      </a>
    </li>
  );
}
