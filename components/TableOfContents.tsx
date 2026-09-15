'use client';

import { useEffect, useState } from 'react';

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

    return () => {
      headings.forEach((heading) => {
        const element = document.getElementById(heading.id);
        if (element) {
          observer.unobserve(element);
        }
      });
    };
  }, [headings]);

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setActiveId(id);
      setIsExpanded(false);
    }
  };

  if (headings.length === 0) {
    return null;
  }

  return (
    <nav className={`${className}`} aria-label="Table of contents">
      {/* Mobile toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left dark:border-gray-700 dark:bg-gray-800 desktop:hidden"
        aria-expanded={isExpanded}
      >
        <span className="text-title-small font-medium">Contents</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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

      {/* Content list */}
      <div className={`${isExpanded ? 'mt-2 block' : 'hidden'} desktop:block`}>
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
                <button
                  onClick={() => handleClick(heading.id)}
                  className={`block w-full rounded px-3 py-1.5 text-left text-sm transition-colors ${indentClass} ${
                    isActive
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  {heading.text}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
