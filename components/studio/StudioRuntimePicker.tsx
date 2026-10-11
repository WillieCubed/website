'use client';
import { useCallback, useEffect, useState } from 'react';

import { studioRequest } from './api';

interface RuntimeChoice {
  connected: boolean;
  devices: {
    id: string;
    name: string;
    status: 'reachable' | 'offline' | 'unpaired' | 'revoked';
  }[];
  selectedRuntimeId: string | null;
}
const statusLabel = {
  reachable: 'Online',
  offline: 'Offline',
  unpaired: 'Not paired',
  revoked: 'Access removed',
};
export default function StudioRuntimePicker({
  onReady,
  returnTo,
}: {
  onReady: (ready: boolean) => void;
  returnTo?: string;
}) {
  const [choices, setChoices] = useState<RuntimeChoice | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('Loading your personal devices…');
  const apply = useCallback(
    (next: RuntimeChoice) => {
      setChoices(next);
      const selected = next.devices.find(
        (device) => device.id === next.selectedRuntimeId
      );
      onReady(
        Boolean(
          next.connected &&
          selected &&
          ['reachable', 'offline'].includes(selected.status)
        )
      );
      setMessage(
        !next.connected
          ? 'Connect Lattice to choose your Lovelace device.'
          : !next.devices.length
            ? 'No personal devices are available. Open Lovelace on your computer and pair it with Lattice.'
            : selected && ['revoked', 'unpaired'].includes(selected.status)
              ? `${selected.name} is no longer paired. Choose another personal device.`
              : selected?.status === 'offline'
                ? `${selected.name} is offline. Your request can wait until you reconnect the device and retry.`
                : selected
                  ? `Using ${selected.name}.`
                  : 'Choose the personal device that should handle your requests.'
      );
    },
    [onReady]
  );
  useEffect(() => {
    let active = true;
    studioRequest<RuntimeChoice>('/lattice/runtime')
      .then((next) => {
        if (active) apply(next);
      })
      .catch((error) => {
        if (active) {
          onReady(false);
          setMessage(error.message);
        }
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [apply, onReady]);
  async function refresh() {
    setBusy(true);
    try {
      apply(await studioRequest<RuntimeChoice>('/lattice/runtime'));
    } catch (error) {
      onReady(false);
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function choose(runtimeId: string) {
    if (!runtimeId) return;
    setBusy(true);
    onReady(false);
    setMessage('Saving your device choice…');
    try {
      apply(
        await studioRequest<RuntimeChoice>('/lattice/runtime', {
          method: 'PATCH',
          body: JSON.stringify({ runtimeId }),
        })
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="studio-runtime">
      <a
        // eslint-disable-next-line site/no-raw-internal-anchor -- OAuth route handler requires a full navigation.
        href={`/api/studio/lattice/connect${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
      >
        {choices?.connected ? 'Reconnect Lattice' : 'Connect Lattice'}
      </a>
      <label>
        Personal device
        <select
          value={choices?.selectedRuntimeId ?? ''}
          disabled={busy || !choices?.connected}
          onChange={(event) => void choose(event.target.value)}
        >
          <option value="" disabled>
            Choose your Lovelace device
          </option>
          {choices?.devices.map((device) => (
            <option
              key={device.id}
              value={device.id}
              disabled={['unpaired', 'revoked'].includes(device.status)}
            >
              {device.name || 'Personal device'} · {statusLabel[device.status]}
            </option>
          ))}
        </select>
      </label>
      <p role="status" aria-live="polite">
        {message}
      </p>
      <p>Requests run on your selected personal device.</p>
      <button type="button" disabled={busy} onClick={() => void refresh()}>
        Refresh devices
      </button>
    </div>
  );
}
