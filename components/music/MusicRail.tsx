'use client';
import { type FormEvent, type ReactNode, useState } from 'react';

import Icon from '@/components/icons/Icon';
import Button from '@/components/site/Button';

import './styles/rail.css';

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
    <aside className="music-rail">
      <div className="music-heading">
        <h1>Music</h1>
        {editing && (
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
        )}
      </div>
      {!publicEmpty && !editing && seriesNavigation}
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
    </aside>
  );
}
