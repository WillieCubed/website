export default function NotesIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <mask
        id="mask0_1449_1528"
        style={{ maskType: 'alpha' }}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="24"
        height="24"
      >
        <rect width="24" height="24" fill="#D9D9D9" />
      </mask>
      <g mask="url(#mask0_1449_1528)">
        <path
          d="M6.98805 22.2033V6.96908H22.2033V17.1376L17.1375 22.2033H6.98805ZM9.20327 19.9881H16.0538V16.0539H19.988V9.20333H9.20327V19.9881ZM4.08477 19.0691L1.42987 4.08483L16.4141 1.42993L17.05 4.98811H14.7907L14.6157 4.00006L4 5.88321L4.98805 11.4734V18.9082L4.08477 19.0691ZM9.20327 19.9881H16.0538L19.988 16.0539V9.20333H9.20327V19.9881Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}
