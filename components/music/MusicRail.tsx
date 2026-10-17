'use client';
import { type FormEvent, type ReactNode, useState } from 'react';

import Icon from '@/components/icons/Icon';
import Button from '@/components/site/Button';

interface Props {
  editing: boolean;
  loading: boolean;
  publicEmpty: boolean;
  seriesNavigation: ReactNode;
  onCreateSeries: (title: string) => void;
}
export default function MusicRail({
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
    <aside className="mp-rail">
      <div className="mp-heading">
        <h1>Music</h1>
        {editing && (
          <Button
            variant="tonal"
            className="mp-new-series"
            disabled={loading}
            onClick={() => setNewSeries('')}
          >
            <Icon name="plus" size={20} />
            <span>Create a series</span>
          </Button>
        )}
      </div>
      {!publicEmpty && !editing && seriesNavigation}
      {newSeries !== null && (
        <form className="mp-new-series-form" onSubmit={addSeries}>
          <label htmlFor="mp-series-title">Series name</label>
          <input
            id="mp-series-title"
            autoFocus
            value={newSeries}
            onChange={(event) => setNewSeries(event.target.value)}
          />
          <div>
            <button className="site-control mp-button" type="submit">
              Create series
            </button>
            <button
              className="site-control mp-text-button"
              type="button"
              onClick={() => setNewSeries(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </aside>
  );
}
