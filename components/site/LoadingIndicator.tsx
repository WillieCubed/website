import './loading.css';

/** An indeterminate MD3 wavy circular indicator; its containing control names the operation. */
export default function LoadingIndicator({
  className = '',
}: {
  className?: string;
}) {
  return (
    <svg
      className={`site-loading-indicator ${className}`}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      aria-hidden="true"
    >
      <path
        d="M12 2 C14 2 14 4 16 4 C18 4 20 4 20 6 C20 8 22 8 22 10 C22 12 20 12 20 14 C20 16 20 18 18 18 C16 18 16 20 14 20 C12 20 12 22 10 22 C8 22 8 20 6 20 C4 20 4 18 4 16 C4 14 2 14 2 12 C2 10 4 10 4 8 C4 6 4 4 6 4 C8 4 8 2 10 2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
