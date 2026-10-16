/** Illustrations repeat the adjacent copy; assistive technology reads the text. */
export function TeapotIllustration() {
  return (
    <svg
      className="colophon-decoration colophon-teapot"
      viewBox="0 0 224 184"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M97 35c-14-12 13-19 0-31M126 36c-14-12 13-19 0-31"
        fill="none"
        stroke="var(--color-on-surface-variant)"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <g transform="rotate(-8 112 112)">
        <path
          d="M158 72c56-11 59 61 7 67"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="16"
        />
        <path d="M65 92 22 66c-2 37 12 58 43 62Z" fill="var(--color-primary)" />
        <path
          d="M73 65c-16 14-27 38-24 61 4 31 25 45 64 45s60-14 64-45c3-23-8-47-24-61Z"
          fill="var(--color-primary-container)"
        />
        <path d="M70 70c21-22 66-22 87 0Z" fill="var(--color-primary)" />
        <path d="M107 50v-6c0-10 17-10 17 0v6" fill="var(--color-primary)" />
        <path
          d="M82 96c-8 11-11 20-9 31"
          fill="none"
          stroke="var(--color-on-primary-container)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <text
          x="117"
          y="135"
          textAnchor="middle"
          fill="var(--color-on-primary-container)"
          fontFamily="var(--font-mono)"
          fontSize="29"
          fontWeight="600"
        >
          418
        </text>
      </g>
    </svg>
  );
}

export function PublishingIllustration() {
  return (
    <svg
      className="colophon-decoration colophon-paper"
      viewBox="0 0 160 152"
      aria-hidden="true"
      focusable="false"
    >
      <g transform="rotate(-9 74 77)">
        <path
          d="M34 16h57l27 27v78c0 9-7 16-16 16H34c-9 0-16-7-16-16V32c0-9 7-16 16-16Z"
          fill="var(--color-primary-container)"
        />
        <path d="M91 16v19c0 5 3 8 8 8h19Z" fill="var(--color-primary)" />
        <path
          d="M38 60h51M38 78h38M38 96h25"
          fill="none"
          stroke="var(--color-on-primary-container)"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </g>
      <circle cx="122" cy="114" r="34" fill="var(--color-tertiary-container)" />
      <g
        fill="none"
        stroke="var(--color-on-tertiary-container)"
        strokeWidth="5"
        strokeLinecap="round"
      >
        <path d="M107 97c18 0 32 14 32 32M107 112c9 0 17 8 17 17" />
      </g>
      <circle
        cx="107"
        cy="129"
        r="3"
        fill="var(--color-on-tertiary-container)"
      />
    </svg>
  );
}
