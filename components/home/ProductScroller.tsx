'use client';

import { useRef, useState } from 'react';

import type { Product } from '@/lib/home/ventures';

import { brandStyle, prefersReducedMotion, useHome } from './HomeContext';

/**
 * The studio tile's product cards. On compact screens they scroll and snap
 * sideways, and the pager follows whichever card has snapped into place.
 */
export function ProductScroller({
  products,
  loading,
}: {
  products: Product[];
  loading: 'eager' | 'lazy';
}) {
  const { openDetail, brands } = useHome();
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
          const step = Math.max(1, list[1].offsetLeft - list[0].offsetLeft);
          setCurrent(
            Math.min(list.length - 1, Math.round(el.scrollLeft / step))
          );
        }}
      >
        {products.map((product) => {
          const style = brandStyle(brands, product.brand);
          return (
            <button
              key={product.id}
              className="product"
              type="button"
              data-product={product.id}
              data-brand={product.brand}
              data-branded={style ? '' : undefined}
              style={style}
              onClick={(event) => openDetail(product.id, event.currentTarget)}
            >
              {/* Decorative: the card's text names the product, and the
                  detail view it opens describes the screenshot. */}
              <span className="product-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image.src}
                  width={product.image.width}
                  height={product.image.height}
                  alt=""
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
            </button>
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
