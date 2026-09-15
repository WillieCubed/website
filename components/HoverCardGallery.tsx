'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ReactNode, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

interface HoverCardGalleryProps {
  children: ReactNode;
  images: string[];
  href?: string;
  alt?: string;
}

// Deterministic rotation pattern for cards
const getRotation = (index: number): number => {
  const rotations = [-3, 4, -5, 6, -2, 5, -4, 3];
  return rotations[index % rotations.length];
};

// Offset each card to create stacked effect
const getOffset = (index: number): { x: number; y: number } => {
  return {
    x: index * 12,
    y: index * 8,
  };
};

export function HoverCardGallery({
  children,
  images,
  href,
  alt = 'Preview',
}: HoverCardGalleryProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isMounted, setIsMounted] = useState(false);

  // Track mount state for portal
  useState(() => {
    setIsMounted(true);
  });

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // Position cards with offset from cursor
    const offsetX = 20;
    const offsetY = -120;

    // Keep cards within viewport
    const x = Math.min(e.clientX + offsetX, window.innerWidth - 280);
    const y = Math.max(e.clientY + offsetY, 20);

    setPosition({ x, y });
  }, []);

  const triggerProps = {
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onMouseMove: handleMouseMove,
    className: 'link-animated cursor-pointer',
  };

  const trigger = href ? (
    <Link href={href} {...triggerProps}>
      {children}
    </Link>
  ) : (
    <span {...triggerProps}>{children}</span>
  );

  const cardGallery = isHovered && typeof window !== 'undefined' && (
    <div
      className="pointer-events-none fixed z-[9999]"
      style={{
        left: position.x,
        top: position.y,
      }}
      aria-hidden="true"
    >
      <div className="relative">
        {images.map((src, index) => {
          const rotation = getRotation(index);
          const offset = getOffset(index);

          return (
            <div
              key={src}
              className="absolute h-32 w-44 overflow-hidden rounded-lg bg-white shadow-xl
                         motion-safe:animate-hover-card-in motion-safe:opacity-0
                         dark:bg-gray-800"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`,
                zIndex: index + 1,
                animationDelay: `${index * 75}ms`,
              }}
            >
              <Image
                src={src}
                alt={`${alt} ${index + 1}`}
                fill
                className="object-cover"
                sizes="176px"
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {trigger}
      {isMounted && cardGallery && createPortal(cardGallery, document.body)}
    </>
  );
}

export default HoverCardGallery;
