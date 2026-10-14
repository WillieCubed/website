'use client';

import { useEffect, useRef, useState } from 'react';

import Icon from '@/components/icons/Icon';

export default function CopyHex({
  name,
  value,
}: {
  name: string;
  value: string;
}) {
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(value);
      setStatus('Copied');
      timer.current = setTimeout(() => setStatus(''), 2500);
    } catch {
      setStatus('Could not copy. Select the hex value and copy it manually.');
    }
  }

  return (
    <div className="brand-copy">
      <div>
        <code>{value}</code>
        <button
          type="button"
          aria-label={`Copy ${name} hex value`}
          onClick={copy}
        >
          <Icon name="copy" size={16} />
        </button>
      </div>
      <span role="status">{status}</span>
    </div>
  );
}
