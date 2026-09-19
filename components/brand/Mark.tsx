interface MarkProps {
  className?: string;
  /** Read out by screen readers. Without it the mark is decoration. */
  title?: string;
}

/**
 * The WillieCubed cube, from public/brand/mark/williecubed-cube-black.svg,
 * drawn in the current text colour so it takes the ink of wherever it sits.
 */
export default function Mark({ className, title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={48.5}
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d="M256 51.03L394.51 131L256 210.97L117.49 131Z" />
      <path d="M78.49 198.55L217 278.52L217 438.45L78.49 358.48Z" />
      <path d="M295 278.52L433.51 198.55L433.51 358.48L295 438.45Z" />
    </svg>
  );
}
