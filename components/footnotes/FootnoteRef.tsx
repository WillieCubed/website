interface FootnoteRefProps {
  id: string;
  index: string;
  content: string;
}

/**
 * Inline footnote reference - superscript number with tooltip on hover.
 * Clicking scrolls to the footnote list on mobile.
 * Uses CSS-only hover for tooltip to work with SSR/SSG.
 */
export function FootnoteRef({ id, index, content }: FootnoteRefProps) {
  const numericIndex = parseInt(index, 10);

  return (
    <span className="relative inline group/footnote">
      <a
        href={`#footnote-${id}`}
        id={`fnref-${id}`}
        className="
          inline-flex items-center justify-center
          text-[0.65em] font-medium
          align-super
          min-w-[1.2em] h-[1.2em]
          rounded-full
          transition-colors duration-150
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1
          bg-gray-200 text-gray-700 hover:bg-primary/20
          dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-primary/30
          no-underline
        "
        aria-describedby={`footnote-${id}`}
        aria-label={`Footnote ${numericIndex}`}
      >
        {numericIndex}
      </a>

      {/* CSS-only tooltip on hover */}
      <span
        role="tooltip"
        className="
          absolute z-50
          bottom-full left-1/2 -translate-x-1/2 mb-2
          max-w-xs p-2
          text-sm text-left font-normal not-italic
          bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900
          rounded-lg shadow-lg
          pointer-events-none
          opacity-0 invisible
          group-hover/footnote:opacity-100 group-hover/footnote:visible
          transition-opacity duration-150
        "
      >
        {content}
        <span
          className="
            absolute top-full left-1/2 -translate-x-1/2
            border-4 border-transparent border-t-gray-900
            dark:border-t-gray-100
          "
        />
      </span>
    </span>
  );
}

export default FootnoteRef;
