import { ReactNode } from 'react';

type CalloutVariant = 'note' | 'warning' | 'tip' | 'info';

interface CalloutProps {
  type?: CalloutVariant;
  title?: string;
  children: ReactNode;
}

const variantStyles: Record<
  CalloutVariant,
  { container: string; icon: string; iconPath: string }
> = {
  note: {
    container:
      'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950',
    icon: 'text-blue-600 dark:text-blue-400',
    iconPath:
      'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  },
  warning: {
    container:
      'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
    icon: 'text-yellow-600 dark:text-yellow-400',
    iconPath:
      'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  },
  tip: {
    container:
      'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
    icon: 'text-green-600 dark:text-green-400',
    iconPath:
      'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  },
  info: {
    container:
      'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800',
    icon: 'text-gray-600 dark:text-gray-400',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
};

const defaultTitles: Record<CalloutVariant, string> = {
  note: 'Note',
  warning: 'Warning',
  tip: 'Tip',
  info: 'Info',
};

export default function Callout({
  type = 'note',
  title,
  children,
}: CalloutProps) {
  const styles = variantStyles[type];
  const displayTitle = title || defaultTitles[type];

  return (
    <div
      className={`my-6 rounded-lg border-l-4 p-4 ${styles.container}`}
      role="note"
    >
      <div className="flex items-start gap-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`mt-0.5 h-5 w-5 flex-shrink-0 ${styles.icon}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d={styles.iconPath}
          />
        </svg>
        <div className="flex-1">
          <p
            className={`mb-1 text-sm font-semibold ${styles.icon.replace('text-', 'text-')}`}
          >
            {displayTitle}
          </p>
          <div className="text-sm text-gray-700 dark:text-gray-300 [&>p]:m-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
