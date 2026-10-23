'use client';
import { type FormEvent, type ReactNode, useState } from 'react';

import Icon from '@/components/icons/Icon';
import Button from '@/components/site/Button';

import MusicRail from './MusicRail';

interface Props {
  editing: boolean;
  loading: boolean;
  publicEmpty: boolean;
  seriesNavigation: ReactNode;
  onCreateSeries: (title: string) => void;
}
export default function MusicAdminRail({
  editing,
  loading,
  publicEmpty,
  seriesNavigation,
  onCreateSeries,
}: Props) {
  const [newSeries, setNewSeries] = useState<string | null>(null);

  function addSeries(event: FormEvent) {
    event.preventDefault();
    const title = newSeries?.trim();
    if (!title) return;
    setNewSeries(null);
    onCreateSeries(title);
  }

  return (
    <MusicRail
      publicEmpty={publicEmpty}
      editing={editing}
      seriesNavigation={seriesNavigation}
      action={
        editing && (
          <Button
            variant="primary"
            size="medium"
            className="music-new-series"
            disabled={loading}
            onClick={() => setNewSeries('')}
          >
            <Icon name="plus" size={20} />
            <span>Create a series</span>
          </Button>
        )
      }
    >
      {newSeries !== null && (
        <form className="music-new-series-form" onSubmit={addSeries}>
          <label htmlFor="music-series-title">Series name</label>
          <input
            id="music-series-title"
            autoFocus
            value={newSeries}
            onChange={(event) => setNewSeries(event.target.value)}
          />
          <div>
            <Button variant="primary" size="small" type="submit">
              Create series
            </Button>
            <Button
              variant="quiet"
              size="small"
              type="button"
              onClick={() => setNewSeries(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </MusicRail>
  );
}
