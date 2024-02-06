export default function FeaturedProjectsIcon({
  className,
}: {
  className?: string;
}) {
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
        id="mask0_1460_1745"
        style={{ maskType: 'alpha' }}
        maskUnits="userSpaceOnUse"
        x="0"
        y="0"
        width="24"
        height="24"
      >
        <rect width="24" height="24" fill="#D9D9D9" />
      </mask>
      <g mask="url(#mask0_1460_1745)">
        <path
          d="M0.76088 21.2033V6.16145H3.03588V18.9283H20.2033V21.2033H0.76088ZM5.03588 16.9283V1.79675H12.1495L14.1495 3.79675H23.2391V16.9283H5.03588ZM7.31088 14.6533H20.9641V6.07178H13.2109L11.2109 4.07178H7.31088V14.6533Z"
          fill="currentColor"
        />
      </g>
    </svg>
  );
}
