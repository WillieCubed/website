'use client';

import { useEffect, useState } from 'react';

import SiteLink from '@/components/link/SiteLink';

import type { TOCHeading } from '@/lib/writings/types';

interface TableOfContentsProps {
  headings: TOCHeading[];
  className?: string;
}

export default function TableOfContents({
  headings,
  className = '',
}: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-80px 0px -80% 0px',
        threshold: 0,
      }
    );

    headings.forEach((heading) => {
      const element = document.getElementById(heading.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className={className} aria-label="Table of contents">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between rounded-lg border border-outline-variant bg-surface-container px-4 py-3 text-left desktop:hidden"
        aria-expanded={isExpanded}
        aria-controls="writing-contents"
      >
        <span className="text-title-small font-medium">Contents</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      <div
        id="writing-contents"
        className={`${isExpanded ? 'mt-2 block' : 'hidden'} desktop:block`}
      >
        <div className="hidden text-title-medium font-medium desktop:mb-4 desktop:block">
          Contents
        </div>
        <ul className="space-y-1">
          {headings.map((heading) => {
            const isActive = activeId === heading.id;
            const indentClass =
              heading.level === 3 ? 'pl-4' : heading.level === 4 ? 'pl-8' : '';

            return (
              <li key={heading.id}>
                <SiteLink
                  href={`#${heading.id}`}
                  onClick={() => {
                    setActiveId(heading.id);
                    setIsExpanded(false);
                  }}
                  aria-current={isActive ? 'location' : undefined}
                  className={`block w-full rounded px-3 py-1.5 text-left text-sm transition-colors ${indentClass} ${
                    isActive
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                  }`}
                >
                  {heading.text}
                </SiteLink>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
