import type { SamplePlaylist } from '@/lib/prototypes/music';

export default function SampleCover({
  playlist,
}: {
  playlist: SamplePlaylist;
}) {
  const { cover, color, ink, coverLabel, year, part } = playlist;
  return (
    <svg
      viewBox="0 0 400 400"
      className="mp-cover"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="400" height="400" fill={color} />
      {cover === 'tour' && (
        <g fill="none" stroke={ink} strokeWidth="1.3" opacity=".38">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <path
              key={n}
              d={`M-40 ${145 + n * 29} Q100 ${25 + n * 24} 215 ${165 + n * 17} T450 ${90 + n * 35}`}
            />
          ))}
          <circle cx="278" cy="211" r="62" />
          <circle cx="278" cy="211" r="48" />
          <circle cx="278" cy="211" r="34" />
          <path
            d="M38 338 102 274 163 297 223 246 278 211 355 242"
            strokeWidth="3"
          />
          {[
            ['38', '338'],
            ['102', '274'],
            ['223', '246'],
            ['278', '211'],
          ].map(([cx, cy]) => (
            <circle
              key={cx}
              cx={cx}
              cy={cy}
              r="5"
              fill={ink}
              stroke={color}
              strokeWidth="3"
            />
          ))}
        </g>
      )}
      {cover === 'summer' && (
        <g fill="none" stroke={ink}>
          <circle cx="270" cy="152" r="91" strokeWidth="23" />
          <path
            d="M-10 308q95-75 190 0t230 0M-10 342q95-75 190 0t230 0M-10 376q95-75 190 0t230 0"
            strokeWidth="3"
          />
        </g>
      )}
      {cover === 'spring' && (
        <g fill={ink}>
          <ellipse
            cx="268"
            cy="164"
            rx="38"
            ry="76"
            transform="rotate(-35 268 164)"
          />
          <ellipse
            cx="220"
            cy="222"
            rx="76"
            ry="38"
            transform="rotate(20 220 222)"
          />
          <ellipse
            cx="286"
            cy="250"
            rx="38"
            ry="76"
            transform="rotate(-35 286 250)"
          />
          <ellipse
            cx="334"
            cy="190"
            rx="76"
            ry="38"
            transform="rotate(20 334 190)"
          />
          <circle cx="276" cy="206" r="25" fill={color} />
          <path
            d="M276 250q-60 60-34 150"
            fill="none"
            stroke={ink}
            strokeWidth="3"
          />
        </g>
      )}
      {cover === 'winter' && (
        <g stroke={ink} strokeWidth="1" opacity=".65">
          {Array.from({ length: 14 }, (_, n) => (
            <path key={n} d={`M${-80 + n * 38} 0 400 ${480 - n * 24}`} />
          ))}
          <circle cx="290" cy="218" r="68" fill={color} />
        </g>
      )}
      {cover === 'night' && (
        <g fill="none" stroke={ink}>
          <path d="M192 400V180a72 72 0 0 1 144 0v220" strokeWidth="3" />
          <path d="M264 108v292M192 230h144" strokeWidth="2" />
          <circle cx="291" cy="177" r="24" fill={ink} stroke="none" />
          <path d="M218 316h94m-94 18h94m-94 18h94" opacity=".5" />
        </g>
      )}
      {cover === 'loose' && (
        <g fill="none" stroke={ink} opacity=".45">
          {[0, 1, 2, 3, 4, 5, 6].map((n) => (
            <path key={n} d={`M0 ${150 + n * 32}h400M${40 + n * 48} 0v400`} />
          ))}
          <path d="m220 200 80 80m-80 0 80-80" strokeWidth="15" opacity="1" />
        </g>
      )}
      <g fill={ink} fontFamily="var(--font-atkinson), sans-serif">
        <text x="28" y="43" fontSize="14" letterSpacing="3">
          {year}
        </text>
        {coverLabel.split(' ').map((word, index) => (
          <text
            key={word}
            x="25"
            y={105 + index * 55}
            fontSize={coverLabel.length > 8 ? 60 : 67}
            fontWeight="700"
            letterSpacing="-3"
          >
            {word}
          </text>
        ))}
        <text x="28" y="372" fontSize="13" letterSpacing="2">
          SAMPLE COVER
        </text>
        {part && (
          <text
            x="370"
            y="374"
            textAnchor="end"
            fontSize="64"
            fontWeight="500"
            letterSpacing="-4"
          >
            {part}
          </text>
        )}
      </g>
    </svg>
  );
}
