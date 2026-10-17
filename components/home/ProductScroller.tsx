'use client';

import { useRef, useState } from 'react';

import SiteLink from '@/components/link/SiteLink';

import { isPlainClick } from '@/lib/dom/click';
import { useHydrated } from '@/lib/dom/hydrated';
import type { Product } from '@/lib/home/ventures';

import { brandStyle, prefersReducedMotion, useHome } from './HomeContext';

/**
 * The studio tile's product cards. On compact screens they scroll and snap
 * sideways, and the pager follows whichever card has snapped into place.
 */
interface ProductScrollerProps {
  products: Product[];
  loading: 'eager' | 'lazy';
}

export function ProductScroller({ products, loading }: ProductScrollerProps) {
  const { openDetail, brands } = useHome();
  const hydrated = useHydrated();
  const scroller = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  const cards = () => [
    ...(scroller.current?.querySelectorAll<HTMLElement>('.product') ?? []),
  ];

  return (
    <>
      <div
        className="products"
        data-media=""
        ref={scroller}
        onScroll={() => {
          const el = scroller.current;
          const list = cards();
          if (!el || list.length < 2) return;
          const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
          const step = Math.max(1, list[1].offsetLeft - list[0].offsetLeft);
          setCurrent(
            atEnd
              ? list.length - 1
              : Math.min(list.length - 1, Math.round(el.scrollLeft / step))
          );
        }}
      >
        {products.map((product) => {
          const style = brandStyle(brands, product.brand);
          return (
            <SiteLink
              href={`/?detail=${product.id}`}
              preview={false}
              prefetch={false}
              key={product.id}
              className="product"
              data-product={product.id}
              data-brand={product.brand}
              data-branded={style ? '' : undefined}
              style={style}
              onClick={(event) => {
                if (!isPlainClick(event)) return;
                event.preventDefault();
                openDetail(product.id, event.currentTarget);
              }}
            >
              {/* Decorative: the card's text names the product, and the
                  detail view it opens describes the screenshot. */}
              <span className="product-media" data-morph={product.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image.src}
                  width={product.image.width}
                  height={product.image.height}
                  alt=""
                  aria-hidden="true"
                  loading={loading}
                  decoding="async"
                />
              </span>
              <span className="product-text">
                <b>{product.name}</b>
                <span>
                  <em className="product-platform">{product.platform}</em>
                  <em className="product-copy">{product.copy}</em>
                </span>
              </span>
            </SiteLink>
          );
        })}
      </div>
      <div
        className="pager"
        role="group"
        aria-label="Hypertext Studio products"
      >
        {products.map((product, i) => (
          <button
            key={product.id}
            type="button"
            className="site-control"
            disabled={!hydrated}
            aria-label={product.name}
            aria-current={i === current}
            onClick={() => {
              const list = cards();
              scroller.current?.scrollTo({
                left: list[i].offsetLeft - list[0].offsetLeft,
                behavior: prefersReducedMotion() ? 'auto' : 'smooth',
              });
            }}
          />
        ))}
      </div>
    </>
  );
}
